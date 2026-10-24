<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/** Creates the single approved first owner after the production schema guard passes. */
final class ProductionOwnerProvisioner
{
    public const OWNER_NAME = 'Dombi Center';

    public const OWNER_EMAIL = 'dombicenter@gmail.com';

    public function seed(string $credentialDirectory): bool
    {
        if (! app()->environment('production')) {
            throw new RuntimeException('Owner seeding requires production environment.');
        }

        $credentialDirectory = $this->validateCredentialDirectory($credentialDirectory);
        $pdo = DB::connection()->getPdo();
        $this->assertConnectionAndSession($pdo);
        $credentialPath = null;
        $password = null;

        try {
            $created = DB::transaction(function () use ($credentialDirectory, $pdo, &$credentialPath, &$password): bool {
                if (DB::connection()->getPdo() !== $pdo) {
                    throw new RuntimeException('Owner write connection changed after identity verification.');
                }

                // Lock before reading state so concurrent invocations observe the committed owner.
                $lock = DB::table('migrations')->orderByDesc('id')->lockForUpdate()->first();
                if ($lock === null) {
                    throw new RuntimeException('Approved migration lock row is missing.');
                }

                $state = $this->assertReady($pdo, true);
                if ($state['owner_count'] === 1) {
                    $owner = User::query()->sole();
                    if ($owner->name !== self::OWNER_NAME
                        || strtolower($owner->email) !== self::OWNER_EMAIL
                        || $owner->role !== 'owner'
                        || ! $owner->is_active
                        || ! $owner->must_change_password) {
                        throw new RuntimeException('Existing account does not match the approved initial owner.');
                    }

                    return false;
                }

                $password = Str::password(48);
                $credentialPath = $this->writeCredential($credentialDirectory, $password);

                User::forceCreate([
                    'name' => self::OWNER_NAME,
                    'email' => self::OWNER_EMAIL,
                    'password' => $password,
                    'role' => 'owner',
                    'is_active' => true,
                    'must_change_password' => true,
                ]);

                return true;
            }, attempts: 1);
        } catch (Throwable) {
            $credentialMayMatchCommittedOwner = false;
            if ($credentialPath !== null && is_file($credentialPath)) {
                try {
                    $storedHash = DB::table('users')->useWritePdo()
                        ->where('email', self::OWNER_EMAIL)->value('password');
                    $credentialMayMatchCommittedOwner = is_string($storedHash)
                        && is_string($password)
                        && Hash::check($password, $storedHash);
                } catch (Throwable) {
                    // Preserve the secret on ambiguous commit outcome so a committed owner is recoverable.
                    $credentialMayMatchCommittedOwner = true;
                }

                if (! $credentialMayMatchCommittedOwner) {
                    @unlink($credentialPath);
                }
            }

            // Do not expose SQL bindings, exception details, or the password through logs/output.
            throw new RuntimeException(
                $credentialMayMatchCommittedOwner
                    ? 'Owner seed outcome is uncertain; reconcile the private credential file and database before retrying.'
                    : 'Owner seed failed safely; reconcile database state before retrying.',
            );
        }

        if ($created && (! is_string($credentialPath) || ! is_file($credentialPath))) {
            throw new RuntimeException('Owner was created but private credential confirmation failed; reconcile before retrying.');
        }

        return $created;
    }

    /** @return array{migration_count:int,table_count:int,owner_count:int,business_rows:int,table_fingerprint:string} */
    public function preflight(bool $allowExistingOwner = true): array
    {
        if (! app()->environment('production')) {
            throw new RuntimeException('Owner preflight requires production environment.');
        }

        $pdo = DB::connection()->getPdo();
        $this->assertConnectionAndSession($pdo);

        return $this->assertReady($pdo, $allowExistingOwner);
    }

    private function assertReady(\PDO $pdo, bool $allowExistingOwner): array
    {
        if (! class_exists(\OwnerBootstrapReadiness::class)) {
            throw new RuntimeException('Owner readiness guard is unavailable.');
        }

        return \OwnerBootstrapReadiness::assertDatabaseReady(
            $pdo,
            \OwnerBootstrapReadiness::DATABASE,
            \OwnerBootstrapReadiness::DATABASE_USER,
            base_path(),
            $allowExistingOwner,
            true,
        );
    }

    private function assertConnectionAndSession(\PDO $pdo): void
    {
        if (DB::getDefaultConnection() !== 'mysql') {
            throw new RuntimeException('Laravel default connection is not mysql.');
        }
        if (DB::connection('mysql')->getPdo() !== $pdo) {
            throw new RuntimeException('Laravel mysql connection is not the guarded PDO.');
        }
        if (! class_exists(\OwnerBootstrapReadiness::class)) {
            throw new RuntimeException('Owner readiness guard is unavailable.');
        }

        \OwnerBootstrapReadiness::assertSessionHandler(
            app(),
            $pdo,
            \OwnerBootstrapReadiness::DATABASE,
            \OwnerBootstrapReadiness::DATABASE_USER,
        );
    }

    private function validateCredentialDirectory(string $directory): string
    {
        if ($directory === '' || is_link($directory) || ! is_dir($directory)) {
            throw new RuntimeException('Private owner credential directory is unavailable.');
        }

        $resolved = realpath($directory);
        if ($resolved === false || (fileperms($resolved) & 0777) !== 0700 || ! is_writable($resolved)) {
            throw new RuntimeException('Private owner credential directory permissions are invalid.');
        }

        foreach ([base_path(), public_path()] as $applicationPath) {
            $applicationRealPath = realpath($applicationPath);
            if ($applicationRealPath !== false && ($resolved === $applicationRealPath
                || str_starts_with($resolved, rtrim($applicationRealPath, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR))) {
                throw new RuntimeException('Private owner credential directory must be outside the application.');
            }
        }

        return $resolved;
    }

    private function writeCredential(string $directory, string $password): string
    {
        $path = $directory.DIRECTORY_SEPARATOR.'dombi-owner-'.Str::uuid().'.txt';
        $previousUmask = umask(0077);
        try {
            $file = fopen($path, 'x');
        } finally {
            umask($previousUmask);
        }

        if ($file === false) {
            throw new RuntimeException('Private credential file could not be created.');
        }

        try {
            chmod($path, 0600);
            $contents = "Dombi initial owner\nEmail: ".self::OWNER_EMAIL."\nTemporary password: {$password}\nChange this password immediately after first login.\n";
            if (fwrite($file, $contents) !== strlen($contents) || ! fflush($file)
                || (function_exists('fsync') && ! fsync($file))) {
                throw new RuntimeException('Private credential file could not be safely written.');
            }
        } catch (Throwable $exception) {
            fclose($file);
            @unlink($path);
            throw $exception;
        }

        fclose($file);
        if ((fileperms($path) & 0777) !== 0600) {
            @unlink($path);
            throw new RuntimeException('Private credential file mode is not 0600.');
        }

        return $path;
    }
}
