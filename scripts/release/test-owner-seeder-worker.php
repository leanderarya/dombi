<?php
declare(strict_types=1);

use Database\Seeders\ProductionOwnerSeeder;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\ApplicationBuilder;

$release = dirname(__DIR__, 2);
$runtime = getenv('DOMBI_TEST_RUNTIME_DIR') ?: '';
$required = ['DOMBI_TEST_MYSQL_PORT', 'DOMBI_TEST_MYSQL_DATABASE', 'DOMBI_TEST_MYSQL_USER', 'DOMBI_TEST_MYSQL_PASSWORD', 'DOMBI_TEST_CREDENTIAL_DIR'];
foreach ($required as $name) {
    if (getenv($name) === false || getenv($name) === '') {
        fwrite(STDERR, "WORKER=BLOCKED\n");
        exit(2);
    }
}
if ($runtime === '' || ! is_dir($runtime) || (fileperms($runtime) & 0777) !== 0700) {
    fwrite(STDERR, "WORKER=BLOCKED\n");
    exit(2);
}

$setEnvironment = static function (string $name, string $value): void {
    putenv($name.'='.$value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
};
foreach ([
    'APP_ENV' => 'production', 'APP_DEBUG' => 'false',
    'APP_CONFIG_CACHE' => $runtime.'/config.php', 'APP_SERVICES_CACHE' => $runtime.'/services.php',
    'APP_PACKAGES_CACHE' => $runtime.'/packages.php', 'APP_EVENTS_CACHE' => $runtime.'/events.php',
    'APP_KEY' => 'base64:'.base64_encode(random_bytes(32)),
    'DB_CONNECTION' => 'mysql', 'DB_HOST' => '127.0.0.1',
    'DB_PORT' => (string) getenv('DOMBI_TEST_MYSQL_PORT'),
    'DB_DATABASE' => (string) getenv('DOMBI_TEST_MYSQL_DATABASE'),
    'DB_USERNAME' => (string) getenv('DOMBI_TEST_MYSQL_USER'),
    'DB_PASSWORD' => (string) getenv('DOMBI_TEST_MYSQL_PASSWORD'),
    'DB_SOCKET' => '', 'DB_CHARSET' => 'utf8mb4', 'DB_COLLATION' => 'utf8mb4_unicode_ci',
    'SESSION_DRIVER' => 'database', 'SESSION_CONNECTION' => 'mysql', 'SESSION_TABLE' => 'sessions',
    'DOMBI_OWNER_CREDENTIAL_DIR' => (string) getenv('DOMBI_TEST_CREDENTIAL_DIR'),
    'CACHE_STORE' => 'array', 'QUEUE_CONNECTION' => 'sync', 'LOG_CHANNEL' => 'stderr',
] as $name => $value) {
    $setEnvironment($name, $value);
}
unset($_ENV['DB_URL'], $_SERVER['DB_URL'], $_ENV['DATABASE_URL'], $_SERVER['DATABASE_URL']);
putenv('DB_URL');
putenv('DATABASE_URL');

if (getenv('DOMBI_TEST_OMIT_READINESS') !== '1') {
    require_once __DIR__.'/OwnerBootstrapReadiness.php';
}
require $release.'/vendor/autoload.php';
$application = (new ApplicationBuilder(new Application($release)))
    ->withKernels()->withEvents(false)->withCommands([])->withProviders([], false)->withExceptions()->create();
$application->make(ConsoleKernel::class)->bootstrap();
$seeder = $application->make(ProductionOwnerSeeder::class);
if (getenv('DOMBI_TEST_OMIT_READINESS') === '1') {
    try {
        $seeder->run();
    } catch (RuntimeException) {
        echo "MISSING_GUARD_DEPENDENCY=REJECTED\n";
        exit(0);
    }
    fwrite(STDERR, "MISSING_GUARD_DEPENDENCY=ACCEPTED\n");
    exit(1);
}
$seeder->run();
echo "WORKER=PASS\n";
