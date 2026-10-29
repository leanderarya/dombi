<?php

declare(strict_types=1);

use App\Providers\AppServiceProvider;
use App\Services\ProductionOwnerProvisioner;
use App\Services\ProductionOwnerSeedFailure;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\ApplicationBuilder;
use Illuminate\Support\Facades\DB;

const DOMBI_RELEASE = '/home/u399215191/private-releases/dombi-v1.0-ea83637aeae57c31d88454149d427d44767df2d8';
const DOMBI_RELEASE_SHA = 'ea83637aeae57c31d88454149d427d44767df2d8';
const DOMBI_CREDENTIALS = '/home/u399215191/private-secrets/dombi-v1-production-db-20261023.cnf';
const DOMBI_OWNER_CREDENTIAL_DIR = '/home/u399215191/private-secrets/dombi-owner-bootstrap-20261024';
const DOMBI_RUNNER = '/home/u399215191/private-releases/dombi-v1.0-ea83637aeae57c31d88454149d427d44767df2d8-owner-bootstrap-runner.php';
const DOMBI_READINESS = '/home/u399215191/private-releases/dombi-v1.0-ea83637aeae57c31d88454149d427d44767df2d8-OwnerBootstrapReadiness.php';
const DOMBI_PROVISIONER = '/home/u399215191/private-releases/dombi-v1.0-ea83637aeae57c31d88454149d427d44767df2d8-ProductionOwnerProvisioner.php';
const DOMBI_SEEDER = '/home/u399215191/private-releases/dombi-v1.0-ea83637aeae57c31d88454149d427d44767df2d8-ProductionOwnerSeeder.php';
const DOMBI_READINESS_SHA256 = '1bd318146bb7fca2acd01ef350bc7bd747761b743b27ade63c608050cd3eab8d';
const DOMBI_PROVISIONER_SHA256 = 'd6deb0b6261ade34c099707ddfffd179b794e9afeec6efc692382bca170d864f';
const DOMBI_SEEDER_SHA256 = 'b7a7bed8eb3d6fc77a3793f5157019d284f5152f6e4cf2137a22bf4d47231834';

const DOMBI_RUNNER_FAILURE_STAGES = [
    'runner_validation', 'release_validation', 'dependency_validation', 'database_configuration',
    'credential_directory_validation', 'private_cache_validation', 'cli_bootstrap', 'database_identity',
    'session_guard', 'readiness', 'operator_confirmation', 'owner_seed', 'credential_postcheck',
    'database_postcheck', 'environment_guard', 'session_guard', 'transaction_begin',
    'write_connection_guard', 'migration_lock', 'credential_write', 'eloquent_insert',
    'transaction_commit', 'postcheck_credential',
];
const DOMBI_RUNNER_FAILURE_CODES = [
    'cli_check_unavailable', 'cli_check_failed', 'cli_only_path_mismatch', 'invalid_mode',
    'private_release_invalid', 'release_identity_mismatch', 'public_path_detected',
    'private_dependency_permissions', 'private_dependency_checksum', 'database_credentials_permissions',
    'database_identity_config', 'mysql_driver_unavailable', 'credential_directory_invalid',
    'credential_directory_not_empty', 'private_cache_invalid', 'unexpected_config_cache',
    'cli_bootstrap_mismatch', 'write_connection_mismatch', 'seed_requires_tty',
    'confirmation_mismatch', 'pre_seed_state_changed', 'credential_postcheck_failed',
    'owner_seed_failed', 'runner_operation_failed', 'filesystem_write_failed', 'filesystem_guard_failed',
    'database_connection_failed', 'database_constraint_failed', 'database_permission_failed',
    'database_operation_failed', 'guard_rejected', 'transaction_failed', 'commit_outcome_ambiguous',
    'outcome_unverified', 'credential_cleanup_failed', 'postcheck_failed', 'operation_failed',
];

$runnerStage = 'runner_validation';
$fail = static function (string $failureCode, int $status = 2, ?string $stage = null) use (&$runnerStage): never {
    $stage ??= $runnerStage;
    if (! in_array($stage, DOMBI_RUNNER_FAILURE_STAGES, true)) {
        $stage = 'runner_validation';
    }
    if (! in_array($failureCode, DOMBI_RUNNER_FAILURE_CODES, true)) {
        $failureCode = 'runner_operation_failed';
    }

    fwrite(STDERR, "PRODUCTION_OWNER_RUNNER=BLOCKED\nFAILURE_STAGE={$stage}\nFAILURE_CODE={$failureCode}\n");
    exit($status);
};

$run = static function (array $arguments) use ($fail): string {
    $pipes = [];
    $process = proc_open($arguments, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (! is_resource($process)) {
        $fail('cli_check_unavailable');
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0 || trim((string) $stderr) !== '') {
        $fail('cli_check_failed');
    }

    return trim((string) $stdout);
};

if (PHP_SAPI !== 'cli' || realpath(__FILE__) !== DOMBI_RUNNER) {
    $fail('cli_only_path_mismatch');
}

$mode = strtoupper($argv[1] ?? 'PREFLIGHT');
if (! in_array($mode, ['PREFLIGHT', 'SEED'], true)) {
    $fail('invalid_mode');
}

umask(0077);
$runnerStage = 'release_validation';
if (is_link(DOMBI_RELEASE) || realpath(DOMBI_RELEASE) !== DOMBI_RELEASE
    || ! is_file(DOMBI_RELEASE.'/vendor/autoload.php')
    || ! is_file(DOMBI_RELEASE.'/bootstrap/app.php')
    || is_file(DOMBI_RELEASE.'/.env') || is_file(DOMBI_RELEASE.'/.env.production')) {
    $fail('private_release_invalid');
}
if ($run(['git', '-C', DOMBI_RELEASE, 'rev-parse', 'HEAD']) !== DOMBI_RELEASE_SHA
    || $run(['git', '-C', DOMBI_RELEASE, 'status', '--porcelain']) !== '') {
    $fail('release_identity_mismatch');
}

foreach (glob('/home/u399215191/domains/*/public_html') ?: [] as $publicRoot) {
    $realPublicRoot = realpath($publicRoot);
    if ($realPublicRoot !== false && str_starts_with(DOMBI_RELEASE.'/', rtrim($realPublicRoot, '/').'/')) {
        $fail('public_path_detected');
    }
}

foreach ([
    DOMBI_READINESS => DOMBI_READINESS_SHA256,
    DOMBI_PROVISIONER => DOMBI_PROVISIONER_SHA256,
    DOMBI_SEEDER => DOMBI_SEEDER_SHA256,
] as $requiredFile => $expectedChecksum) {
    $runnerStage = 'dependency_validation';
    if (is_link($requiredFile) || ! is_file($requiredFile) || (fileperms($requiredFile) & 0777) !== 0600) {
        $fail('private_dependency_permissions');
    }
    if (! hash_equals($expectedChecksum, (string) hash_file('sha256', $requiredFile))) {
        $fail('private_dependency_checksum');
    }
}
$runnerStage = 'database_configuration';
if (is_link(DOMBI_CREDENTIALS) || ! is_file(DOMBI_CREDENTIALS)
    || (fileperms(DOMBI_CREDENTIALS) & 0777) !== 0600
    || (fileperms(dirname(DOMBI_CREDENTIALS)) & 0777) !== 0700) {
    $fail('database_credentials_permissions');
}
$credentialData = parse_ini_file(DOMBI_CREDENTIALS, true, INI_SCANNER_RAW);
$credential = is_array($credentialData) ? ($credentialData['client'] ?? null) : null;
if (! is_array($credential)
    || ! isset($credential['host'], $credential['port'], $credential['user'], $credential['password'], $credential['database'])
    || strtoupper((string) ($credential['protocol'] ?? 'TCP')) !== 'TCP'
    || (string) $credential['database'] !== 'u399215191_dombi_pr_1023'
    || (string) $credential['user'] !== 'u399215191_dombi_ap_1023') {
    $fail('database_identity_config');
}
$port = filter_var($credential['port'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
if ($port === false || ! extension_loaded('pdo_mysql')) {
    $fail('mysql_driver_unavailable');
}

$runnerStage = 'credential_directory_validation';
$credentialDirectory = DOMBI_OWNER_CREDENTIAL_DIR;
if (is_link($credentialDirectory) || ! is_dir($credentialDirectory)
    || realpath($credentialDirectory) !== $credentialDirectory
    || (fileperms($credentialDirectory) & 0777) !== 0700
    || str_starts_with($credentialDirectory.'/', rtrim(DOMBI_RELEASE, '/').'/')) {
    $fail('credential_directory_invalid');
}
if (glob($credentialDirectory.'/*') !== []) {
    $fail('credential_directory_not_empty');
}

$runnerStage = 'private_cache_validation';
$cacheDirectory = DOMBI_RELEASE.'/bootstrap/cache/owner-bootstrap-cli';
if (is_link($cacheDirectory) || ! is_dir($cacheDirectory)
    || realpath($cacheDirectory) !== $cacheDirectory || (fileperms($cacheDirectory) & 0777) !== 0700) {
    $fail('private_cache_invalid');
}
if (is_file($cacheDirectory.'/config.php') || is_link($cacheDirectory.'/config.php')) {
    $fail('unexpected_config_cache');
}

$setEnvironment = static function (string $name, string $value): void {
    putenv($name.'='.$value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
};
unset($_ENV['DB_URL'], $_SERVER['DB_URL'], $_ENV['DATABASE_URL'], $_SERVER['DATABASE_URL']);
putenv('DB_URL');
putenv('DATABASE_URL');
$environment = [
    'APP_ENV' => 'production', 'APP_DEBUG' => 'false',
    'APP_CONFIG_CACHE' => $cacheDirectory.'/config.php',
    'APP_SERVICES_CACHE' => $cacheDirectory.'/services.php',
    'APP_PACKAGES_CACHE' => $cacheDirectory.'/packages.php',
    'APP_EVENTS_CACHE' => $cacheDirectory.'/events.php',
    'DB_CONNECTION' => 'mysql', 'DB_HOST' => (string) $credential['host'],
    'DB_PORT' => (string) $port, 'DB_DATABASE' => 'u399215191_dombi_pr_1023',
    'DB_USERNAME' => 'u399215191_dombi_ap_1023', 'DB_PASSWORD' => (string) $credential['password'],
    'DB_SOCKET' => '', 'DB_CHARSET' => 'utf8mb4', 'DB_COLLATION' => 'utf8mb4_unicode_ci',
    'SESSION_DRIVER' => 'database', 'SESSION_CONNECTION' => 'mysql', 'SESSION_TABLE' => 'sessions',
    'DOMBI_OWNER_CREDENTIAL_DIR' => $credentialDirectory,
    'CACHE_STORE' => 'array', 'QUEUE_CONNECTION' => 'sync', 'LOG_CHANNEL' => 'stderr',
];
foreach ($environment as $name => $value) {
    $setEnvironment($name, $value);
}

try {
    $runnerStage = 'cli_bootstrap';
    require DOMBI_RELEASE.'/vendor/autoload.php';
    require_once DOMBI_READINESS;
    require_once DOMBI_PROVISIONER;
    require_once DOMBI_SEEDER;
    $app = (new ApplicationBuilder(new Application(DOMBI_RELEASE)))
        ->withKernels()->withEvents(false)->withCommands([])->withProviders([], false)->withExceptions()->create();
    $app->make(ConsoleKernel::class)->bootstrap();
    if ($app->environment() !== 'production' || config('database.default') !== 'mysql'
        || $app->getProvider(AppServiceProvider::class) !== null) {
        $fail('cli_bootstrap_mismatch');
    }

    $runnerStage = 'database_identity';
    $connection = DB::connection('mysql');
    $pdo = $connection->getPdo();
    OwnerBootstrapReadiness::assertIdentity($pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023');
    $runnerStage = 'session_guard';
    OwnerBootstrapReadiness::assertSessionHandler($app, $pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023');
    if ($connection !== DB::connection() || $connection->getPdo() !== $pdo) {
        $fail('write_connection_mismatch');
    }

    $runnerStage = 'readiness';
    $pdo->exec('START TRANSACTION READ ONLY');
    $database = app(ProductionOwnerProvisioner::class)->preflight(false);
    $pdo->exec('ROLLBACK');

    if ($mode === 'PREFLIGHT') {
        echo "PRODUCTION_OWNER_PREFLIGHT=PASS\nRELEASE_SHA=".DOMBI_RELEASE_SHA."\n";
        echo "DB_IDENTITY=approved_new\nMIGRATIONS=165_exact\nTABLES=68_exact\n";
        echo "SESSION_DRIVER=database\nSESSION_TABLE=sessions\nSESSION_HANDLER=verified_default_mysql\n";
        echo "USERS={$database['owner_count']}\nBUSINESS_ROWS={$database['business_rows']}\n";
        echo "DEFAULT_MODE=read_only\nOWNER_SEEDER_INVOKED=no\nDOKU_ACTIONS=none\n";
        exit(0);
    }

    $runnerStage = 'operator_confirmation';
    if (! defined('STDIN') || ! function_exists('posix_isatty') || ! posix_isatty(STDIN)) {
        $fail('seed_requires_tty');
    }
    $phrase = 'SEED OWNER Dombi Center dombicenter@gmail.com '.DOMBI_RELEASE_SHA;
    fwrite(STDOUT, "Type exactly: {$phrase}\n> ");
    if (trim((string) fgets(STDIN)) !== $phrase) {
        $fail('confirmation_mismatch');
    }
    $runnerStage = 'owner_seed';
    if (glob($credentialDirectory.'/*') !== [] || DB::connection('mysql')->getPdo() !== $pdo) {
        $fail('pre_seed_state_changed');
    }

    app(ProductionOwnerProvisioner::class)->seed($credentialDirectory);
    $runnerStage = 'credential_postcheck';
    $createdFiles = glob($credentialDirectory.'/*') ?: [];
    if (count($createdFiles) !== 1 || is_link($createdFiles[0])
        || (fileperms($createdFiles[0]) & 0777) !== 0600
        || DB::connection('mysql')->getPdo() !== $pdo) {
        $fail('credential_postcheck_failed');
    }
    $runnerStage = 'database_postcheck';
    OwnerBootstrapReadiness::assertDatabaseReady($pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023', DOMBI_RELEASE, true);
    echo "PRODUCTION_OWNER_SEED=PASS\nOWNER=Dombi Center <dombicenter@gmail.com>\n";
    echo "CREDENTIAL_FILE_MODE=0600\nFIRST_LOGIN_PASSWORD_CHANGE=required\n";
    exit(0);
} catch (ProductionOwnerSeedFailure $exception) {
    fwrite(STDERR, "PRODUCTION_OWNER_RUNNER=BLOCKED\n{$exception->safeDiagnostic()}\n");
    exit(2);
} catch (Throwable) {
    $fail('runner_operation_failed', 2, $runnerStage);
}
