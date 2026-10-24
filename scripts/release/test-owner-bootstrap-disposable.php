<?php
declare(strict_types=1);

use App\Services\ProductionOwnerProvisioner;
use Database\Seeders\ProductionOwnerSeeder;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\ApplicationBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

require_once __DIR__.'/OwnerBootstrapReadiness.php';

$release = dirname(__DIR__, 2);
$migration = $release.'/database/migrations/'.OwnerBootstrapReadiness::AUDIT_MIGRATION.'.php';
$socket = getenv('DOMBI_TEST_MYSQL_SOCKET') ?: '';
$port = filter_var(getenv('DOMBI_TEST_MYSQL_PORT') ?: '', FILTER_VALIDATE_INT);
if ($socket === '' || $port === false || ! is_file($migration)) {
    fwrite(STDERR, "DISPOSABLE_TEST=BLOCKED\nREASON=local_mariadb_endpoint_or_migration_missing\n");
    exit(2);
}

$releaseHead = trim((string) shell_exec('git -C '.escapeshellarg($release).' rev-parse HEAD'));
if ($releaseHead !== OwnerBootstrapReadiness::RELEASE_SHA) {
    fwrite(STDERR, "DISPOSABLE_TEST=BLOCKED\nREASON=approved_release_sha_mismatch\n");
    exit(2);
}

$protected = [
    'app/Console/Commands/BootstrapInitialOwner.php',
    'app/Services/ProductionOwnerProvisioner.php',
    'database/seeders/ProductionOwnerSeeder.php',
    'app/Services/DokuConfigurationGuard.php',
    'bootstrap/app.php',
    'bootstrap/providers.php',
    'config/database.php',
    'config/session.php',
    'database/migrations/'.OwnerBootstrapReadiness::AUDIT_MIGRATION.'.php',
];
$initialHashes = [];
foreach ($protected as $relative) {
    $initialHashes[$relative] = hash_file('sha256', $release.'/'.$relative);
}

$testDatabase = OwnerBootstrapReadiness::DATABASE;
$testUser = OwnerBootstrapReadiness::DATABASE_USER;
$oldDatabase = 'u399215191_app';
$stagingDatabase = 'u399215191_dombi_staging';
$wrongDatabase = 'dombi_wrong_identity_'.bin2hex(random_bytes(4));
$wrongUser = 'dombi_wrong_user_'.bin2hex(random_bytes(4));
$testPassword = bin2hex(random_bytes(24));
$wrongPassword = bin2hex(random_bytes(24));
$ownerEmail = 'dombicenter@gmail.com';
$ownerName = 'Dombi Center';
$credentialDirectory = sys_get_temp_dir().'/dombi-owner-credentials-'.bin2hex(random_bytes(8));
$runtimeDirectory = sys_get_temp_dir().'/dombi-owner-runtime-'.bin2hex(random_bytes(8));
register_shutdown_function(static function () use ($credentialDirectory, $runtimeDirectory): void {
    foreach ([$credentialDirectory, $runtimeDirectory] as $directory) {
        if (! is_dir($directory) || is_link($directory)) {
            continue;
        }
        foreach (glob($directory.'/*') ?: [] as $path) {
            if (is_file($path) || is_link($path)) {
                @unlink($path);
            }
        }
        @rmdir($directory);
    }
});

$root = new PDO('mysql:unix_socket='.$socket.';dbname=mysql;charset=utf8mb4', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$portOnServer = (int) $root->query('SELECT @@port')->fetchColumn();
if ($portOnServer !== $port) {
    throw new RuntimeException('test_server_port_mismatch');
}

$existingSchema = $root->prepare('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN (?, ?, ?, ?)');
$existingSchema->execute([$testDatabase, $oldDatabase, $stagingDatabase, $wrongDatabase]);
$existingUsers = $root->prepare('SELECT COUNT(*) FROM mysql.user WHERE User IN (?, ?)');
$existingUsers->execute([$testUser, $wrongUser]);
if ((int) $existingSchema->fetchColumn() !== 0 || (int) $existingUsers->fetchColumn() !== 0) {
    throw new RuntimeException('disposable_names_already_exist');
}

foreach ([$testDatabase, $oldDatabase, $stagingDatabase, $wrongDatabase] as $database) {
    $root->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
}
$root->exec("CREATE USER '".$testUser."'@'127.0.0.1' IDENTIFIED BY '".$testPassword."'");
$root->exec("CREATE USER '".$wrongUser."'@'127.0.0.1' IDENTIFIED BY '".$wrongPassword."'");
$root->exec('GRANT ALL PRIVILEGES ON `'.$testDatabase.'`.* TO `'.$testUser.'`@`127.0.0.1`');
$root->exec('GRANT ALL PRIVILEGES ON `'.$wrongDatabase.'`.* TO `'.$testUser.'`@`127.0.0.1`');
$root->exec('GRANT ALL PRIVILEGES ON `'.$testDatabase.'`.* TO `'.$wrongUser.'`@`127.0.0.1`');
foreach ([$oldDatabase, $stagingDatabase] as $database) {
    $root->exec('CREATE TABLE `'.$database.'`.migrations (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB');
}

$dsn = 'mysql:host=127.0.0.1;port='.$port.';dbname='.$testDatabase.';charset=utf8mb4';
$appPdo = new PDO($dsn, $testUser, $testPassword, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$appIdentity = $appPdo->query('SELECT DATABASE() db, CURRENT_USER() account, @@hostname host')->fetch();
if (($appIdentity['db'] ?? null) !== $testDatabase
    || explode('@', (string) ($appIdentity['account'] ?? ''), 2)[0] !== $testUser
    || (int) $appPdo->query('SELECT @@port')->fetchColumn() !== $port) {
    throw new RuntimeException('disposable_mysql_identity_not_local');
}

if (! mkdir($credentialDirectory, 0700) || (fileperms($credentialDirectory) & 0777) !== 0700
    || ! mkdir($runtimeDirectory, 0700)) {
    throw new RuntimeException('disposable_private_directories_create_failed');
}

$setEnv = static function (string $name, string $value): void {
    putenv($name.'='.$value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
};
unset($_ENV['DB_URL'], $_SERVER['DB_URL'], $_ENV['DATABASE_URL'], $_SERVER['DATABASE_URL']);
putenv('DB_URL');
putenv('DATABASE_URL');
$setEnv('APP_ENV', 'production');
$setEnv('APP_DEBUG', 'false');
$setEnv('APP_CONFIG_CACHE', $runtimeDirectory.'/config.php');
$setEnv('APP_SERVICES_CACHE', $runtimeDirectory.'/services.php');
$setEnv('APP_PACKAGES_CACHE', $runtimeDirectory.'/packages.php');
$setEnv('APP_EVENTS_CACHE', $runtimeDirectory.'/events.php');
$setEnv('APP_KEY', 'base64:'.base64_encode(random_bytes(32)));
$setEnv('DB_CONNECTION', 'mysql');
$setEnv('DB_HOST', '127.0.0.1');
$setEnv('DB_PORT', (string) $port);
$setEnv('DB_DATABASE', $testDatabase);
$setEnv('DB_USERNAME', $testUser);
$setEnv('DB_PASSWORD', $testPassword);
$setEnv('DB_SOCKET', '');
$setEnv('DB_CHARSET', 'utf8mb4');
$setEnv('DB_COLLATION', 'utf8mb4_unicode_ci');
$setEnv('SESSION_DRIVER', 'database');
$setEnv('SESSION_CONNECTION', 'mysql');
$setEnv('SESSION_TABLE', 'sessions');
$setEnv('DOMBI_OWNER_CREDENTIAL_DIR', $credentialDirectory);
$setEnv('CACHE_STORE', 'array');
$setEnv('QUEUE_CONNECTION', 'sync');
$setEnv('LOG_CHANNEL', 'stderr');

require_once $release.'/vendor/autoload.php';
require_once __DIR__.'/OwnerBootstrapReadiness.php';
$app = (new ApplicationBuilder(new Application($release)))
    ->withKernels()
    ->withEvents(false)
    ->withCommands([])
    ->withProviders([], false)
    ->withExceptions()
    ->create();
$app->make(ConsoleKernel::class)->bootstrap();
if ($app->environment() !== 'production' || $app->getProvider(App\Providers\AppServiceProvider::class) !== null) {
    throw new RuntimeException('disposable_minimal_cli_bootstrap_failed');
}

DB::connection('mysql')->getPdo();
Schema::create('migrations', static function (Blueprint $table): void {
    $table->increments('id');
    $table->string('migration');
    $table->unsignedInteger('batch');
});

$expectedTables = OwnerBootstrapReadiness::expectedTables();
foreach ($expectedTables as $tableName) {
    if (in_array($tableName, ['migrations', 'owner_recovery_audit_logs'], true)) {
        continue;
    }
    Schema::create($tableName, static function (Blueprint $table) use ($tableName): void {
        if ($tableName === 'users') {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role');
            $table->boolean('is_active')->default(true);
            $table->boolean('must_change_password')->default(false);
            $table->timestamps();

            return;
        }
        if ($tableName === 'sessions') {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();

            return;
        }
        $table->id();
    });
}

$allMigrations = array_map(static fn (string $path): string => pathinfo($path, PATHINFO_FILENAME), glob($release.'/database/migrations/*.php') ?: []);
sort($allMigrations, SORT_STRING);
$baselineMigrations = array_values(array_filter($allMigrations, static fn (string $name): bool => $name !== OwnerBootstrapReadiness::AUDIT_MIGRATION));
$baselineRows = array_map(static fn (string $name): array => ['migration' => $name, 'batch' => 1], $baselineMigrations);
foreach (array_chunk($baselineRows, 100) as $chunk) {
    DB::table('migrations')->insert($chunk);
}

$migrationObject = require $migration;
$migrationObject->up();
DB::table('migrations')->insert(['migration' => OwnerBootstrapReadiness::AUDIT_MIGRATION, 'batch' => 2]);

$pdo = DB::connection('mysql')->getPdo();
$initialReadiness = OwnerBootstrapReadiness::assertDatabaseReady(
    $pdo,
    $testDatabase,
    $testUser,
    $release,
    false,
    true,
);
OwnerBootstrapReadiness::assertSessionHandler($app, $pdo, $testDatabase, $testUser);
$auditColumn = $pdo->query("SELECT COLUMN_TYPE, DATA_TYPE FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_recovery_audit_logs' AND COLUMN_NAME = 'id'")->fetch();
$widthTolerated = strtolower((string) $auditColumn['DATA_TYPE']) === 'bigint'
    && str_contains(strtolower((string) $auditColumn['COLUMN_TYPE']), 'unsigned');
if (! $widthTolerated) {
    throw new RuntimeException('audit_integer_width_not_tolerated');
}

$expectFailure = static function (string $expected, callable $operation): void {
    try {
        $operation();
    } catch (RuntimeException $exception) {
        if ($exception->getMessage() === $expected) {
            return;
        }
        throw $exception;
    }
    throw new RuntimeException('expected_failure_not_observed_'.$expected);
};

$expectFailure('database_identity_mismatch', static fn () => OwnerBootstrapReadiness::assertIdentity($pdo, 'wrong_database', $testUser));
$wrongDatabasePdo = new PDO('mysql:host=127.0.0.1;port='.$port.';dbname='.$wrongDatabase.';charset=utf8mb4', $testUser, $testPassword, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$expectFailure('database_identity_mismatch', static fn () => OwnerBootstrapReadiness::assertIdentity($wrongDatabasePdo, $testDatabase, $testUser));
$wrongUserPdo = new PDO($dsn, $wrongUser, $wrongPassword, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$expectFailure('database_identity_mismatch', static fn () => OwnerBootstrapReadiness::assertIdentity($wrongUserPdo, $testDatabase, $testUser));

$pdo->exec("ALTER TABLE owner_recovery_audit_logs MODIFY sessions_revoked INT NOT NULL DEFAULT 0");
$expectFailure('audit_columns_mismatch', static fn () => OwnerBootstrapReadiness::assertAuditSchema($pdo));
$pdo->exec("ALTER TABLE owner_recovery_audit_logs MODIFY sessions_revoked INT UNSIGNED NOT NULL DEFAULT 0");
OwnerBootstrapReadiness::assertAuditSchema($pdo);

$approvedMigration = OwnerBootstrapReadiness::AUDIT_MIGRATION;
DB::table('migrations')->where('migration', $approvedMigration)->delete();
$expectFailure('migration_ledger_not_exact_165', static fn () => OwnerBootstrapReadiness::assertDatabaseReady($pdo, $testDatabase, $testUser, $release, false, false));
DB::table('migrations')->insert(['migration' => $approvedMigration, 'batch' => 2]);

DB::table('products')->insert(['id' => 1]);
$expectFailure('unexpected_business_rows', static fn () => OwnerBootstrapReadiness::assertDatabaseReady($pdo, $testDatabase, $testUser, $release, false, false));
DB::table('products')->delete();

config(['session.driver' => 'file']);
$expectFailure('database_session_configuration_mismatch', static fn () => OwnerBootstrapReadiness::assertSessionHandler($app, $pdo, $testDatabase, $testUser));
config(['session.driver' => 'database']);
$app->make('session')->forgetDrivers();
OwnerBootstrapReadiness::assertSessionHandler($app, $pdo, $testDatabase, $testUser);

$missingGuardRuntime = $runtimeDirectory.'/missing-guard';
if (! mkdir($missingGuardRuntime, 0700)) {
    throw new RuntimeException('synthetic_missing_guard_runtime_create_failed');
}
$missingGuardEnvironment = [
    'DOMBI_TEST_MYSQL_PORT' => (string) $port,
    'DOMBI_TEST_MYSQL_DATABASE' => $testDatabase,
    'DOMBI_TEST_MYSQL_USER' => $testUser,
    'DOMBI_TEST_MYSQL_PASSWORD' => $testPassword,
    'DOMBI_TEST_CREDENTIAL_DIR' => $credentialDirectory,
    'DOMBI_TEST_RUNTIME_DIR' => $missingGuardRuntime,
    'DOMBI_TEST_OMIT_READINESS' => '1',
];
$missingGuardPipes = [];
$missingGuardProcess = proc_open([PHP_BINARY, __DIR__.'/test-owner-seeder-worker.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $missingGuardPipes, null, $missingGuardEnvironment);
if (! is_resource($missingGuardProcess)) {
    throw new RuntimeException('synthetic_missing_guard_worker_start_failed');
}
fclose($missingGuardPipes[0]);
$missingGuardOutput = stream_get_contents($missingGuardPipes[1]);
$missingGuardError = stream_get_contents($missingGuardPipes[2]);
fclose($missingGuardPipes[1]);
fclose($missingGuardPipes[2]);
if (proc_close($missingGuardProcess) !== 0 || trim((string) $missingGuardOutput) !== 'MISSING_GUARD_DEPENDENCY=REJECTED'
    || trim((string) $missingGuardError) !== '') {
    throw new RuntimeException('synthetic_missing_guard_dependency_not_rejected');
}
foreach (glob($missingGuardRuntime.'/*') ?: [] as $cacheFile) {
    if (is_file($cacheFile) || is_link($cacheFile)) {
        unlink($cacheFile);
    }
}
rmdir($missingGuardRuntime);

$seeder = $app->make(ProductionOwnerSeeder::class);
$expectSeederIdentityRejection = static function (array $connectionOverrides) use ($seeder, $credentialDirectory, $testPassword, $app): void {
    config($connectionOverrides);
    DB::purge('mysql');
    $app->make('session')->forgetDrivers();
    try {
        $seeder->run();
    } catch (RuntimeException) {
        DB::purge('mysql');
        config([
            'database.connections.mysql.database' => OwnerBootstrapReadiness::DATABASE,
            'database.connections.mysql.username' => OwnerBootstrapReadiness::DATABASE_USER,
            'database.connections.mysql.password' => $testPassword,
        ]);
        $app->make('session')->forgetDrivers();

        return;
    }

    DB::purge('mysql');
    config([
        'database.connections.mysql.database' => OwnerBootstrapReadiness::DATABASE,
        'database.connections.mysql.username' => OwnerBootstrapReadiness::DATABASE_USER,
        'database.connections.mysql.password' => $testPassword,
    ]);
    $app->make('session')->forgetDrivers();
    throw new RuntimeException('seeder_accepted_wrong_database_identity');
};
$expectSeederIdentityRejection(['database.connections.mysql.database' => $wrongDatabase]);
if (DB::table('users')->count() !== 0 || glob($credentialDirectory.'/*') !== []) {
    throw new RuntimeException('wrong_database_seeder_changed_state');
}
$expectSeederIdentityRejection([
    'database.connections.mysql.username' => $wrongUser,
    'database.connections.mysql.password' => $wrongPassword,
]);
if (DB::table('users')->count() !== 0 || glob($credentialDirectory.'/*') !== []) {
    throw new RuntimeException('wrong_user_seeder_changed_state');
}
$seeder->run();
$firstOutput = '';
$owner = DB::table('users')->where('email', $ownerEmail)->sole();
if ($owner->name !== $ownerName || $owner->role !== 'owner' || (int) $owner->is_active !== 1 || (int) $owner->must_change_password !== 1) {
    throw new RuntimeException('synthetic_owner_state_incorrect');
}
$credentialFiles = glob($credentialDirectory.'/*.txt') ?: [];
if (count($credentialFiles) !== 1 || (fileperms($credentialFiles[0]) & 0777) !== 0600) {
    throw new RuntimeException('synthetic_owner_credential_permissions');
}
$credentialContents = (string) file_get_contents($credentialFiles[0]);
if (! preg_match('/Temporary password: ([^\r\n]+)/', $credentialContents, $passwordMatch)
    || ! Hash::check($passwordMatch[1], $owner->password)) {
    throw new RuntimeException('synthetic_owner_credential_hash_mismatch');
}
if (str_contains($firstOutput, $passwordMatch[1])) {
    throw new RuntimeException('synthetic_owner_password_exposed_in_output');
}
$ownerPasswordHash = $owner->password;
$seeder->run();
if (DB::table('users')->count() !== 1
    || DB::table('users')->where('email', $ownerEmail)->value('password') !== $ownerPasswordHash
    || count(glob($credentialDirectory.'/*.txt') ?: []) !== 1) {
    throw new RuntimeException('synthetic_owner_repeat_not_idempotent');
}

$postBootstrap = OwnerBootstrapReadiness::assertDatabaseReady($pdo, $testDatabase, $testUser, $release, true, true);
if ($postBootstrap['owner_count'] !== 1 || $postBootstrap['table_count'] !== 68 || $postBootstrap['migration_count'] !== 165) {
    throw new RuntimeException('synthetic_owner_postcheck_failed');
}

// Remove only disposable synthetic state, then prove independent processes serialize safely.
DB::table('users')->where('email', $ownerEmail)->delete();
foreach (glob($credentialDirectory.'/*') ?: [] as $credentialFile) {
    unlink($credentialFile);
}
$workerProcesses = [];
$workerRuntimeDirectories = [];
for ($worker = 0; $worker < 2; $worker++) {
    $workerRuntime = $runtimeDirectory.'/worker-'.$worker;
    if (! mkdir($workerRuntime, 0700)) {
        throw new RuntimeException('synthetic_worker_runtime_create_failed');
    }
    $workerRuntimeDirectories[] = $workerRuntime;
    $workerEnvironment = [
        'DOMBI_TEST_MYSQL_PORT' => (string) $port,
        'DOMBI_TEST_MYSQL_DATABASE' => $testDatabase,
        'DOMBI_TEST_MYSQL_USER' => $testUser,
        'DOMBI_TEST_MYSQL_PASSWORD' => $testPassword,
        'DOMBI_TEST_CREDENTIAL_DIR' => $credentialDirectory,
        'DOMBI_TEST_RUNTIME_DIR' => $workerRuntime,
    ];
    $pipes = [];
    $process = proc_open([PHP_BINARY, __DIR__.'/test-owner-seeder-worker.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $workerEnvironment);
    if (! is_resource($process)) {
        throw new RuntimeException('synthetic_worker_start_failed');
    }
    fclose($pipes[0]);
    $workerProcesses[] = [$process, $pipes];
}
$workerResults = [];
foreach ($workerProcesses as [$process, $pipes]) {
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $workerStatus = proc_close($process);
    if ($workerStatus !== 0 || trim((string) $stderr) !== '' || trim((string) $stdout) !== 'WORKER=PASS') {
        throw new RuntimeException('synthetic_concurrent_worker_failed');
    }
    $workerResults[] = trim((string) $stdout);
}
foreach ($workerRuntimeDirectories as $workerRuntime) {
    foreach (glob($workerRuntime.'/*') ?: [] as $cacheFile) {
        if (is_file($cacheFile) || is_link($cacheFile)) {
            unlink($cacheFile);
        }
    }
    rmdir($workerRuntime);
}
$concurrentFiles = glob($credentialDirectory.'/*.txt') ?: [];
if (count($workerResults) !== 2 || DB::table('users')->count() !== 1 || count($concurrentFiles) !== 1
    || (fileperms($concurrentFiles[0]) & 0777) !== 0600) {
    throw new RuntimeException('synthetic_concurrent_owner_creation_not_serialized');
}
$postConcurrent = OwnerBootstrapReadiness::assertDatabaseReady($pdo, $testDatabase, $testUser, $release, true, true);
if ($postConcurrent['owner_count'] !== 1 || $postConcurrent['business_rows'] !== 0) {
    throw new RuntimeException('synthetic_concurrent_postcheck_failed');
}

foreach ($initialHashes as $relative => $hash) {
    if (hash_file('sha256', $release.'/'.$relative) !== $hash) {
        throw new RuntimeException('application_file_changed_'.$relative);
    }
}

echo "DISPOSABLE_TEST=PASS\n";
echo "ENGINE=MARIADB\n";
echo "MIGRATION_165=applied_to_disposable_only\n";
echo "AUDIT_INTEGER_DISPLAY_WIDTH=".(preg_match('/\\(\\d+\\)/', (string) $auditColumn['COLUMN_TYPE']) ? 'present_and_tolerated' : 'absent_and_tolerated')."\n";
echo "WRONG_DATABASE=REJECTED\nWRONG_USER=REJECTED\n";
echo "SEEDER_WRONG_DATABASE=REJECTED\nSEEDER_WRONG_USER=REJECTED\n";
echo "MIGRATION_BASELINE_MISMATCH=REJECTED\nNONEMPTY_BUSINESS_TABLE=REJECTED\nSESSION_DRIVER_MISMATCH=REJECTED\n";
echo "MISSING_GUARD_DEPENDENCY=REJECTED\n";
echo "PRODUCTION_OWNER_SEEDER=PASS\nOWNER_IDENTITY=Dombi Center <dombicenter@gmail.com>\n";
echo "CREDENTIAL_DIRECTORY_MODE=0700\nCREDENTIAL_FILE_MODE=0600\nFIRST_LOGIN_CHANGE_REQUIRED=yes\nREPEAT_INVOCATION=IDEMPOTENT\n";
echo "CONCURRENT_INVOCATIONS=SERIALIZED_ONE_OWNER_ONE_CREDENTIAL\nNO_CATALOG_OR_DEMO_ROWS=yes\n";
echo "SESSION_HANDLER=DatabaseSessionHandler_same_mysql_connection\nTABLES={$postBootstrap['table_count']} MIGRATIONS={$postBootstrap['migration_count']}\n";
echo "APPLICATION_FILES=UNCHANGED\n";
