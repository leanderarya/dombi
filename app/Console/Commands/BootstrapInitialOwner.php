<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class BootstrapInitialOwner extends Command
{
    protected $signature = 'dombi:bootstrap-owner
        {--name= : Approved owner name}
        {--email= : Approved owner email}
        {--credential-dir= : Existing private directory, mode 0700}';

    protected $description = 'Create the first Dombi owner on an approved empty database and store a one-time credential privately.';

    private const PRODUCTION_DATABASE = 'u399215191_dombi_pr_1023';

    private const PRODUCTION_USER = 'u399215191_dombi_ap_1023';

    private const EXPECTED_MIGRATIONS = 165;

    /** @var list<string> */
    private const REQUIRED_V1_TABLES = [
        'users',
        'outlets',
        'product_categories',
        'product_flavor_groups',
        'products',
        'orders',
        'payment_attempts',
        'offline_sales',
        'settlements',
        'outlet_inventories',
        'owner_recovery_audit_logs',
    ];

    public function handle(): int
    {
        $name = trim((string) ($this->option('name') ?: $this->ask('Approved owner name')));
        $email = strtolower(trim((string) ($this->option('email') ?: $this->ask('Approved owner email'))));
        $credentialDirectory = trim((string) ($this->option('credential-dir') ?: $this->ask('Existing private credential directory')));

        if ($name === '' || mb_strlen($name) > 255 || ! filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
            $this->error('Owner identity is invalid. No account was created.');

            return self::FAILURE;
        }

        $credentialDirectory = $this->validatedCredentialDirectory($credentialDirectory);
        if ($credentialDirectory === null) {
            $this->error('Credential directory must exist outside the application with private permissions. No account was created.');

            return self::FAILURE;
        }

        if (! $this->hasApprovedDatabaseIdentity()) {
            $this->error('Database identity is not the approved NEW database or a disposable in-memory test database. No account was created.');

            return self::FAILURE;
        }

        $credentialPath = null;
        $generatedPassword = null;
        try {
            $result = DB::transaction(function () use ($name, $email, $credentialDirectory, &$credentialPath, &$generatedPassword): array {
                // Serialize this command's first-owner check against another invocation.
                $migrationLock = DB::table('migrations')->orderByDesc('id')->lockForUpdate()->first();
                if ($migrationLock === null) {
                    throw new \RuntimeException('Migration lock row is missing.');
                }

                if (DB::table('migrations')->count() !== self::EXPECTED_MIGRATIONS) {
                    throw new \RuntimeException('Database migration baseline does not match the approved empty schema.');
                }

                $existingUsers = User::query()->orderBy('id')->get();
                if ($existingUsers->isNotEmpty()) {
                    if ($existingUsers->count() === 1
                        && $existingUsers->first()->role === 'owner'
                        && strtolower($existingUsers->first()->email) === $email) {
                        return ['created' => false, 'credential_path' => null];
                    }

                    throw new \RuntimeException('Database is not empty for initial owner bootstrap.');
                }

                foreach (self::REQUIRED_V1_TABLES as $table) {
                    if (! Schema::hasTable($table)) {
                        throw new \RuntimeException('Database schema does not match the approved V1 installation.');
                    }
                }

                foreach (Schema::getTableListing(null, false) as $table) {
                    if ($table !== 'migrations' && DB::table($table)->exists()) {
                        throw new \RuntimeException('Database is not an empty approved V1 installation.');
                    }
                }

                $generatedPassword = Str::password(40);
                $credentialPath = $this->writePrivateCredential($credentialDirectory, $email, $generatedPassword);

                $owner = new User;
                $owner->forceFill([
                    'name' => $name,
                    'email' => $email,
                    'password' => $generatedPassword,
                    'role' => 'owner',
                    'is_active' => true,
                    'must_change_password' => true,
                ])->save();

                return ['created' => true, 'credential_path' => $credentialPath];
            });
        } catch (Throwable $exception) {
            $credentialMayBelongToCommittedOwner = false;
            if ($credentialPath !== null && is_file($credentialPath)) {
                try {
                    $storedPassword = DB::table('users')->useWritePdo()->where('email', $email)->value('password');
                    $credentialMayBelongToCommittedOwner = is_string($storedPassword)
                        && is_string($generatedPassword)
                        && Hash::check($generatedPassword, $storedPassword);
                } catch (Throwable) {
                    // If commit outcome cannot be checked, retain the private file to avoid
                    // locking a committed owner out. Reconcile the file and DB privately.
                    $credentialMayBelongToCommittedOwner = true;
                }

                if (! $credentialMayBelongToCommittedOwner) {
                    @unlink($credentialPath);
                }
            }

            // Database exceptions can contain SQL bindings. Never log or echo them here.
            $this->error($credentialMayBelongToCommittedOwner
                ? 'Owner bootstrap outcome is uncertain. A private credential file was retained; inspect database and file privately before retrying.'
                : 'Owner bootstrap failed safely. No credential was displayed; no account change was confirmed.');

            return self::FAILURE;
        }

        if (! $result['created']) {
            $this->info('The approved initial owner already exists. No changes were made.');

            return self::SUCCESS;
        }

        $this->info('Initial owner created. One-time credential stored privately at: '.$result['credential_path']);
        $this->warn('Deliver it only through an approved private channel. The account must change it at first login.');

        return self::SUCCESS;
    }

    private function hasApprovedDatabaseIdentity(): bool
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();

        if (app()->environment('testing')) {
            return $driver === 'sqlite' && $connection->getDatabaseName() === ':memory:';
        }

        if (! app()->environment('production') || $driver !== 'mysql') {
            return false;
        }

        try {
            // Inspect the write PDO, which is the connection used by the creation transaction.
            $identity = $connection->getPdo()
                ->query('SELECT DATABASE() AS schema_name, CURRENT_USER() AS account_name')
                ->fetch(\PDO::FETCH_OBJ);
        } catch (Throwable) {
            return false;
        }

        return $identity?->schema_name === self::PRODUCTION_DATABASE
            && explode('@', (string) $identity?->account_name, 2)[0] === self::PRODUCTION_USER;
    }

    private function validatedCredentialDirectory(string $directory): ?string
    {
        if ($directory === '' || is_link($directory) || ! is_dir($directory)) {
            return null;
        }

        $realDirectory = realpath($directory);
        if ($realDirectory === false || (fileperms($realDirectory) & 0777) !== 0700 || ! is_writable($realDirectory)) {
            return null;
        }

        foreach ([base_path(), public_path()] as $applicationPath) {
            $realApplicationPath = realpath($applicationPath);
            if ($realApplicationPath !== false
                && ($realDirectory === $realApplicationPath
                    || str_starts_with($realDirectory, rtrim($realApplicationPath, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR))) {
                return null;
            }
        }

        return $realDirectory;
    }

    private function writePrivateCredential(string $directory, string $email, string $password): string
    {
        $path = $directory.DIRECTORY_SEPARATOR.'dombi-owner-'.Str::uuid().'.txt';
        $previousUmask = umask(0077);
        try {
            $handle = fopen($path, 'x');
        } finally {
            umask($previousUmask);
        }

        if ($handle === false) {
            throw new \RuntimeException('Could not create private credential file.');
        }

        try {
            chmod($path, 0600);
            $contents = "Dombi initial owner\nEmail: {$email}\nTemporary password: {$password}\nChange this password immediately after first login.\n";
            if (fwrite($handle, $contents) !== strlen($contents) || ! fflush($handle)) {
                throw new \RuntimeException('Could not write private credential file.');
            }
            if (function_exists('fsync') && ! fsync($handle)) {
                throw new \RuntimeException('Could not sync private credential file.');
            }
        } catch (Throwable $exception) {
            fclose($handle);
            @unlink($path);
            throw $exception;
        }

        fclose($handle);
        if ((fileperms($path) & 0777) !== 0600) {
            @unlink($path);
            throw new \RuntimeException('Credential file permissions are not private.');
        }

        return $path;
    }
}
