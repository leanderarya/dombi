<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PDO;
use RuntimeException;
use Throwable;

class RecoverOwnerPassword extends Command
{
    protected $signature = 'dombi:recover-owner
        {--owner-email= : Must match the approved owner account}
        {--confirm-recovery= : Must exactly match the recovery confirmation phrase}
        {--credential-dir= : Existing private directory with mode 0700}
        {--operation-id= : Stable UUID to reuse when retrying the same operation}';

    protected $description = 'Safely issue a private one-time password for the approved Dombi owner account.';

    private const APPROVED_OWNER_EMAIL = 'dombicenter@gmail.com';

    private const CONFIRMATION_PHRASE = 'RECOVER OWNER dombicenter@gmail.com';

    private const PRODUCTION_DATABASE = 'u399215191_dombi_pr_1023';

    private const PRODUCTION_USER = 'u399215191_dombi_ap_1023';

    private const DISPOSABLE_TEST_DATABASE = 'dombi_owner_recovery_test';

    private const DISPOSABLE_TEST_USER = 'dombi_owner_test';

    private const AUDIT_TABLE = 'owner_recovery_audit_logs';

    private const AUDIT_MIGRATION = '2026_10_23_000001_create_owner_recovery_audit_logs_table';

    public function handle(): int
    {
        $ownerEmail = strtolower(trim((string) $this->option('owner-email')));
        $confirmation = trim((string) $this->option('confirm-recovery'));
        $credentialDirectory = $this->validatedCredentialDirectory(trim((string) $this->option('credential-dir')));
        $operationId = strtolower(trim((string) ($this->option('operation-id') ?: Str::uuid()->toString())));

        if ($ownerEmail !== self::APPROVED_OWNER_EMAIL
            || ! hash_equals(self::CONFIRMATION_PHRASE, $confirmation)
            || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $operationId)) {
            $this->error('Owner identity, explicit confirmation, or operation ID is invalid. No change was made.');

            return self::FAILURE;
        }

        if ($credentialDirectory === null) {
            $this->error('Credential directory must already exist with private permissions outside the application. No change was made.');

            return self::FAILURE;
        }

        if (! $this->hasApprovedDatabaseIdentity()) {
            $this->error('Database identity is not the approved production database or the isolated disposable recovery-test database. No change was made.');

            return self::FAILURE;
        }

        if (! $this->hasExpectedSchema()) {
            $this->error('Database schema is incomplete or unexpected. No change was made.');

            return self::FAILURE;
        }

        try {
            $sessionContext = $this->sessionRevocationContext();
        } catch (Throwable) {
            $sessionContext = null;
        }

        if ($sessionContext === null) {
            $this->error('The configured session store cannot be safely revoked. No change was made.');

            return self::FAILURE;
        }

        $owners = User::query()->useWritePdo()->whereRaw('LOWER(email) = ?', [self::APPROVED_OWNER_EMAIL])->limit(2)->get();
        if ($owners->count() !== 1 || ! $this->isApprovedOwner($owners->first())) {
            $this->error('The approved active owner account was not found. No account was changed.');

            return self::FAILURE;
        }
        $owner = $owners->first();

        $existingEvent = DB::table(self::AUDIT_TABLE)->useWritePdo()->where('operation_id', $operationId)->first();
        if ($existingEvent !== null) {
            if ((int) $existingEvent->user_id !== (int) $owner->getKey()) {
                $this->error('Operation ID is already bound to another account. No change was made.');

                return self::FAILURE;
            }

            $this->info('This recovery operation was already applied. No password was changed.');
            $this->line('Operation ID: '.$operationId);
            $this->line('Private credential file, if still retained: '.$this->credentialPath($credentialDirectory, $operationId));

            return self::SUCCESS;
        }

        if ($owner->must_change_password) {
            $this->error('A password change is already pending for the approved owner. Resolve that recovery before starting another.');

            return self::FAILURE;
        }

        $credentialPath = $this->credentialPath($credentialDirectory, $operationId);
        $credentialWasPresent = is_file($credentialPath) || is_link($credentialPath);
        $credentialPrepared = false;
        $temporaryPassword = null;

        try {
            $temporaryPassword = $this->loadOrCreateCredential(
                $credentialPath,
                $operationId,
                self::APPROVED_OWNER_EMAIL,
                $credentialWasPresent,
            );
            $credentialPrepared = true;

            $applied = DB::transaction(function () use ($owner, $operationId, $temporaryPassword, $sessionContext): bool {
                /** @var User|null $lockedOwner */
                $lockedOwner = User::query()->whereKey($owner->getKey())->lockForUpdate()->first();
                if (! $this->isApprovedOwner($lockedOwner)) {
                    throw new RuntimeException('Owner account changed while recovery was being prepared.');
                }

                $event = DB::table(self::AUDIT_TABLE)->where('operation_id', $operationId)->lockForUpdate()->first();
                if ($event !== null) {
                    if ((int) $event->user_id !== (int) $lockedOwner->getKey()) {
                        throw new RuntimeException('Operation ID belongs to another account.');
                    }

                    return false;
                }

                if ($lockedOwner->must_change_password) {
                    throw new RuntimeException('A password change is already pending for the approved owner.');
                }

                [$sessionDriver, $revokedSessions] = $this->revokeDatabaseSessions($lockedOwner, $sessionContext);

                $lockedOwner->forceFill([
                    'password' => $temporaryPassword,
                    'remember_token' => Str::random(60),
                    'must_change_password' => true,
                ])->save();

                DB::table(self::AUDIT_TABLE)->insert([
                    'operation_id' => $operationId,
                    'user_id' => $lockedOwner->getKey(),
                    'event' => 'owner_password_recovered',
                    'operator' => $this->operatorIdentity(),
                    'session_driver' => $sessionDriver,
                    'sessions_revoked' => $revokedSessions,
                    'created_at' => now(),
                ]);

                return true;
            }, attempts: 1);
        } catch (Throwable) {
            $databaseState = $this->operationWasCommitted($owner, $operationId, $temporaryPassword);
            $fileMayBelongToAnotherInvocation = ! $credentialPrepared && (is_file($credentialPath) || is_link($credentialPath));
            $credentialRetained = $credentialWasPresent || $databaseState !== false || $fileMayBelongToAnotherInvocation;

            if (! $credentialRetained && $credentialPrepared && is_file($credentialPath) && ! is_link($credentialPath)) {
                @unlink($credentialPath);
            }

            $this->error($credentialRetained
                ? 'Recovery outcome could not be confirmed. Keep the private credential file and reconcile the database before retrying.'
                : 'Recovery failed safely. The database change was not confirmed and the new private file was removed.');
            $this->line('Operation ID: '.$operationId);
            if ($credentialRetained) {
                $this->line('Private credential file: '.$credentialPath);
            }

            return self::FAILURE;
        }

        if (! $applied) {
            $this->info('This recovery operation was already applied. No password was changed.');
        } else {
            $this->info('Owner recovery password was stored privately; it was not printed.');
        }

        $this->line('Operation ID: '.$operationId);
        $this->line('Private credential file: '.$credentialPath);
        $this->warn('Use the private file through an approved channel, then securely remove it after the owner confirms the password change.');

        return self::SUCCESS;
    }

    private function hasApprovedDatabaseIdentity(): bool
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();

        if (app()->environment('testing')) {
            if ($driver === 'sqlite') {
                return $connection->getDatabaseName() === ':memory:';
            }

            if ($driver !== 'mysql'
                || ! in_array((string) $connection->getConfig('host'), ['127.0.0.1', '::1'], true)
                || ! in_array((string) $connection->getConfig('url'), ['', 'null'], true)
                || $connection->getDatabaseName() !== self::DISPOSABLE_TEST_DATABASE
                || (string) $connection->getConfig('username') !== self::DISPOSABLE_TEST_USER) {
                return false;
            }

            return $this->matchesDatabaseIdentity($connection, self::DISPOSABLE_TEST_DATABASE, self::DISPOSABLE_TEST_USER);
        }

        if (! app()->environment('production')
            || $driver !== 'mysql'
            || $connection->getDatabaseName() !== self::PRODUCTION_DATABASE
            || (string) $connection->getConfig('username') !== self::PRODUCTION_USER) {
            return false;
        }

        return $this->matchesDatabaseIdentity($connection, self::PRODUCTION_DATABASE, self::PRODUCTION_USER);
    }

    private function matchesDatabaseIdentity(Connection $connection, string $expectedDatabase, string $expectedUser): bool
    {
        try {
            $identity = $connection->getPdo()
                ->query('SELECT DATABASE() AS schema_name, CURRENT_USER() AS account_name')
                ->fetch(PDO::FETCH_OBJ);
        } catch (Throwable) {
            return false;
        }

        return $identity?->schema_name === $expectedDatabase
            && explode('@', (string) $identity?->account_name, 2)[0] === $expectedUser;
    }

    private function hasExpectedSchema(): bool
    {
        $requiredColumns = [
            'migrations' => ['migration', 'batch'],
            'users' => ['id', 'email', 'password', 'remember_token', 'role', 'is_active', 'must_change_password'],
            self::AUDIT_TABLE => ['operation_id', 'user_id', 'event', 'operator', 'session_driver', 'sessions_revoked', 'created_at'],
        ];

        foreach ($requiredColumns as $table => $expectedColumns) {
            if (! Schema::hasTable($table)) {
                return false;
            }

            if (array_diff($expectedColumns, Schema::getColumnListing($table)) !== []) {
                return false;
            }
        }

        return DB::table('migrations')->where('migration', self::AUDIT_MIGRATION)->exists();
    }

    private function isApprovedOwner(?User $user): bool
    {
        return $user !== null
            && strtolower((string) $user->email) === self::APPROVED_OWNER_EMAIL
            && $user->role === 'owner'
            && (bool) $user->is_active;
    }

    /** @return array{connection: string, table: string} */
    private function sessionRevocationContext(): ?array
    {
        $driver = config('session.driver');
        if (! is_string($driver) || $driver !== 'database') {
            return null;
        }

        $applicationConnection = DB::getDefaultConnection();
        $configuredConnection = config('session.connection');
        if ($configuredConnection !== null
            && (! is_string($configuredConnection) || $configuredConnection === '')) {
            return null;
        }
        $sessionConnection = $configuredConnection ?? $applicationConnection;
        if ($sessionConnection !== $applicationConnection) {
            return null;
        }

        $table = config('session.table');
        if (! is_string($table) || ! preg_match('/^[A-Za-z0-9_]+$/', $table)) {
            return null;
        }

        $store = app('session')->driver();
        $handler = $store->getHandler();
        if (! $handler instanceof DatabaseSessionHandler) {
            return null;
        }

        $handlerConnection = $this->protectedHandlerProperty($handler, 'connection');
        $handlerTable = $this->protectedHandlerProperty($handler, 'table');
        if (! $handlerConnection instanceof ConnectionInterface
            || $handlerConnection !== DB::connection($applicationConnection)
            || $handlerTable !== $table) {
            return null;
        }

        $schema = Schema::connection($applicationConnection);
        if (! $schema->hasTable($table)
            || array_diff(['id', 'user_id', 'payload', 'last_activity'], $schema->getColumnListing($table)) !== []) {
            return null;
        }

        return ['connection' => $applicationConnection, 'table' => $table];
    }

    private function protectedHandlerProperty(DatabaseSessionHandler $handler, string $property): mixed
    {
        $reflection = new \ReflectionObject($handler);
        while ($reflection !== false) {
            if ($reflection->hasProperty($property)) {
                return $reflection->getProperty($property)->getValue($handler);
            }

            $reflection = $reflection->getParentClass();
        }

        return null;
    }

    /** @param array{connection: string, table: string} $context
     * @return array{0: string, 1: int}
     */
    private function revokeDatabaseSessions(User $owner, array $context): array
    {
        $sessions = DB::connection($context['connection'])
            ->table($context['table'])
            ->where('user_id', $owner->getKey());
        $count = $sessions->count();
        $sessions->delete();

        return ['database:revoked', $count];
    }

    private function operationWasCommitted(User $owner, string $operationId, ?string $temporaryPassword): ?bool
    {
        try {
            $event = DB::table(self::AUDIT_TABLE)->useWritePdo()->where('operation_id', $operationId)->first();
            if ($event !== null) {
                return (int) $event->user_id === (int) $owner->getKey();
            }

            if ($temporaryPassword === null) {
                return false;
            }

            $storedPassword = DB::table('users')->useWritePdo()->where('id', $owner->getKey())->value('password');

            return is_string($storedPassword) && Hash::check($temporaryPassword, $storedPassword);
        } catch (Throwable) {
            return null;
        }
    }

    private function validatedCredentialDirectory(string $directory): ?string
    {
        if ($directory === '' || is_link($directory) || ! is_dir($directory)) {
            return null;
        }

        $realDirectory = realpath($directory);
        if ($realDirectory === false
            || (fileperms($realDirectory) & 0777) !== 0700
            || ! is_writable($realDirectory)) {
            return null;
        }

        if (function_exists('posix_geteuid') && fileowner($realDirectory) !== posix_geteuid()) {
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

    private function credentialPath(string $directory, string $operationId): string
    {
        return $directory.DIRECTORY_SEPARATOR.'dombi-owner-recovery-'.$operationId.'.txt';
    }

    private function loadOrCreateCredential(string $path, string $operationId, string $email, bool $alreadyPresent): string
    {
        if ($alreadyPresent) {
            if (is_link($path) || ! is_file($path) || (fileperms($path) & 0777) !== 0600) {
                throw new RuntimeException('Existing recovery credential file is not private.');
            }

            $contents = @file_get_contents($path);
            if (! is_string($contents)
                || ! str_contains($contents, "Operation ID: {$operationId}\n")
                || ! str_contains($contents, "Owner email: {$email}\n")
                || ! preg_match('/^Temporary password: ([^\r\n]{40,})$/m', $contents, $match)) {
                throw new RuntimeException('Existing recovery credential file is incomplete or does not match this operation.');
            }

            return $match[1];
        }

        do {
            $temporaryPassword = Str::password(48);
        } while (! preg_match('/[A-Z]/', $temporaryPassword)
            || ! preg_match('/[a-z]/', $temporaryPassword)
            || ! preg_match('/[0-9]/', $temporaryPassword)
            || ! preg_match('/[^A-Za-z0-9]/', $temporaryPassword));
        $contents = "Dombi owner recovery\nOperation ID: {$operationId}\nOwner email: {$email}\nTemporary password: {$temporaryPassword}\nChange this password at the first login, then securely remove this file.\n";
        $previousUmask = umask(0077);
        try {
            $handle = @fopen($path, 'x');
        } finally {
            umask($previousUmask);
        }

        if ($handle === false) {
            throw new RuntimeException('Could not create the private recovery credential file.');
        }

        try {
            if (! @chmod($path, 0600) || (fileperms($path) & 0777) !== 0600) {
                throw new RuntimeException('Recovery credential file permissions are not private.');
            }

            if (fwrite($handle, $contents) !== strlen($contents) || ! fflush($handle)) {
                throw new RuntimeException('Could not write the private recovery credential file.');
            }

            if (function_exists('fsync') && ! fsync($handle)) {
                throw new RuntimeException('Could not sync the private recovery credential file.');
            }
        } catch (Throwable $exception) {
            fclose($handle);
            @unlink($path);
            throw $exception;
        }

        fclose($handle);
        if ((fileperms($path) & 0777) !== 0600) {
            @unlink($path);
            throw new RuntimeException('Recovery credential file permissions changed unexpectedly.');
        }

        return $temporaryPassword;
    }

    private function operatorIdentity(): string
    {
        if (function_exists('posix_geteuid') && function_exists('posix_getpwuid')) {
            $uid = posix_geteuid();
            $account = posix_getpwuid($uid);
            if (is_array($account) && is_string($account['name'] ?? null) && $account['name'] !== '') {
                return 'uid:'.$uid.':'.$account['name'];
            }

            return 'uid:'.$uid;
        }

        return 'php-file-owner:'.get_current_user();
    }
}
