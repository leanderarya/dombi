<?php

declare(strict_types=1);

use App\Providers\AppServiceProvider;
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

$fail = static function (string $reason, int $status = 2): never {
    fwrite(STDERR, "PRODUCTION_OWNER_RUNNER=BLOCKED\nREASON={$reason}\n");
    exit($status);
};

$run = static function (array $arguments) use ($fail): string {
    $pipes = [];
    $process = proc_open($arguments, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (! is_resource($process)) {
        $fail('required_cli_check_unavailable');
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0 || trim((string) $stderr) !== '') {
        $fail('required_cli_check_failed');
    }

    return trim((string) $stdout);
};

if (PHP_SAPI !== 'cli' || realpath(__FILE__) !== DOMBI_RUNNER) {
    $fail('cli_only_or_path_mismatch');
}

$mode = strtoupper($argv[1] ?? 'PREFLIGHT');
if (! in_array($mode, ['PREFLIGHT', 'SEED'], true)) {
    $fail('mode_must_be_PREFLIGHT_or_SEED');
}

umask(0077);
if (is_link(DOMBI_RELEASE) || realpath(DOMBI_RELEASE) !== DOMBI_RELEASE
    || ! is_file(DOMBI_RELEASE.'/vendor/autoload.php')
    || ! is_file(DOMBI_RELEASE.'/bootstrap/app.php')
    || is_file(DOMBI_RELEASE.'/.env') || is_file(DOMBI_RELEASE.'/.env.production')) {
    $fail('private_release_path_or_environment_file');
}
if ($run(['git', '-C', DOMBI_RELEASE, 'rev-parse', 'HEAD']) !== DOMBI_RELEASE_SHA
    || $run(['git', '-C', DOMBI_RELEASE, 'status', '--porcelain']) !== '') {
    $fail('release_sha_or_worktree');
}

foreach (glob('/home/u399215191/domains/*/public_html') ?: [] as $publicRoot) {
    $realPublicRoot = realpath($publicRoot);
    if ($realPublicRoot !== false && str_starts_with(DOMBI_RELEASE.'/', rtrim($realPublicRoot, '/').'/')) {
        $fail('private_release_resolves_under_public_root');
    }
}

foreach ([
    DOMBI_READINESS => DOMBI_READINESS_SHA256,
    DOMBI_PROVISIONER => DOMBI_PROVISIONER_SHA256,
    DOMBI_SEEDER => DOMBI_SEEDER_SHA256,
] as $requiredFile => $expectedChecksum) {
    if (is_link($requiredFile) || ! is_file($requiredFile) || (fileperms($requiredFile) & 0777) !== 0600) {
        $fail('private_runner_dependency_permissions');
    }
    if (! hash_equals($expectedChecksum, (string) hash_file('sha256', $requiredFile))) {
        $fail('private_runner_dependency_checksum');
    }
}
if (is_link(DOMBI_CREDENTIALS) || ! is_file(DOMBI_CREDENTIALS)
    || (fileperms(DOMBI_CREDENTIALS) & 0777) !== 0600
    || (fileperms(dirname(DOMBI_CREDENTIALS)) & 0777) !== 0700) {
    $fail('private_database_credentials_permissions');
}
$credentialData = parse_ini_file(DOMBI_CREDENTIALS, true, INI_SCANNER_RAW);
$credential = is_array($credentialData) ? ($credentialData['client'] ?? null) : null;
if (! is_array($credential)
    || ! isset($credential['host'], $credential['port'], $credential['user'], $credential['password'], $credential['database'])
    || strtoupper((string) ($credential['protocol'] ?? 'TCP')) !== 'TCP'
    || (string) $credential['database'] !== 'u399215191_dombi_pr_1023'
    || (string) $credential['user'] !== 'u399215191_dombi_ap_1023') {
    $fail('private_database_config_identity');
}
$port = filter_var($credential['port'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
if ($port === false || ! extension_loaded('pdo_mysql')) {
    $fail('mysql_driver_unavailable');
}

$credentialDirectory = DOMBI_OWNER_CREDENTIAL_DIR;
if (is_link($credentialDirectory) || ! is_dir($credentialDirectory)
    || realpath($credentialDirectory) !== $credentialDirectory
    || (fileperms($credentialDirectory) & 0777) !== 0700
    || str_starts_with($credentialDirectory.'/', rtrim(DOMBI_RELEASE, '/').'/')) {
    $fail('owner_credential_directory_permissions_or_location');
}
if (glob($credentialDirectory.'/*') !== []) {
    $fail('owner_credential_directory_not_empty');
}

$cacheDirectory = DOMBI_RELEASE.'/bootstrap/cache/owner-bootstrap-cli';
if (is_link($cacheDirectory) || ! is_dir($cacheDirectory)
    || realpath($cacheDirectory) !== $cacheDirectory || (fileperms($cacheDirectory) & 0777) !== 0700) {
    $fail('private_cli_cache_permissions');
}
if (is_file($cacheDirectory.'/config.php') || is_link($cacheDirectory.'/config.php')) {
    $fail('unexpected_cli_config_cache');
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

require DOMBI_RELEASE.'/vendor/autoload.php';
require_once DOMBI_READINESS;
require_once DOMBI_PROVISIONER;
require_once DOMBI_SEEDER;
$app = (new ApplicationBuilder(new Application(DOMBI_RELEASE)))
    ->withKernels()->withEvents(false)->withCommands([])->withProviders([], false)->withExceptions()->create();

try {
    $app->make(ConsoleKernel::class)->bootstrap();
    if ($app->environment() !== 'production' || config('database.default') !== 'mysql'
        || $app->getProvider(AppServiceProvider::class) !== null) {
        $fail('isolated_production_cli_bootstrap_mismatch');
    }

    $connection = DB::connection('mysql');
    $pdo = $connection->getPdo();
    OwnerBootstrapReadiness::assertIdentity($pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023');
    OwnerBootstrapReadiness::assertSessionHandler($app, $pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023');
    if ($connection !== DB::connection() || $connection->getPdo() !== $pdo) {
        $fail('laravel_default_write_connection_mismatch');
    }

    $pdo->exec('START TRANSACTION READ ONLY');
    $database = app(App\Services\ProductionOwnerProvisioner::class)->preflight(false);
    $pdo->exec('ROLLBACK');

    if ($mode === 'PREFLIGHT') {
        echo "PRODUCTION_OWNER_PREFLIGHT=PASS\nRELEASE_SHA=".DOMBI_RELEASE_SHA."\n";
        echo "DB_IDENTITY=approved_new\nMIGRATIONS=165_exact\nTABLES=68_exact\n";
        echo "SESSION_DRIVER=database\nSESSION_TABLE=sessions\nSESSION_HANDLER=verified_default_mysql\n";
        echo "USERS={$database['owner_count']}\nBUSINESS_ROWS={$database['business_rows']}\n";
        echo "DEFAULT_MODE=read_only\nOWNER_SEEDER_INVOKED=no\nDOKU_ACTIONS=none\n";
        exit(0);
    }

    if (! defined('STDIN') || ! function_exists('posix_isatty') || ! posix_isatty(STDIN)) {
        $fail('seed_requires_interactive_operator');
    }
    $phrase = 'SEED OWNER Dombi Center dombicenter@gmail.com '.DOMBI_RELEASE_SHA;
    fwrite(STDOUT, "Type exactly: {$phrase}\n> ");
    if (trim((string) fgets(STDIN)) !== $phrase) {
        $fail('operator_confirmation_mismatch');
    }
    if (glob($credentialDirectory.'/*') !== [] || DB::connection('mysql')->getPdo() !== $pdo) {
        $fail('pre_seed_state_changed');
    }

    app(ProductionOwnerProvisioner::class)->seed($credentialDirectory);
    $createdFiles = glob($credentialDirectory.'/*') ?: [];
    if (count($createdFiles) !== 1 || is_link($createdFiles[0])
        || (fileperms($createdFiles[0]) & 0777) !== 0600
        || DB::connection('mysql')->getPdo() !== $pdo) {
        $fail('owner_credential_or_connection_postcheck');
    }
    OwnerBootstrapReadiness::assertDatabaseReady($pdo, 'u399215191_dombi_pr_1023', 'u399215191_dombi_ap_1023', DOMBI_RELEASE, true);
    echo "PRODUCTION_OWNER_SEED=PASS\nOWNER=Dombi Center <dombicenter@gmail.com>\n";
    echo "CREDENTIAL_FILE_MODE=0600\nFIRST_LOGIN_PASSWORD_CHANGE=required\n";
    exit(0);
} catch (Throwable) {
    $fail('guarded_owner_runner_failed; reconcile state before retrying');
}
