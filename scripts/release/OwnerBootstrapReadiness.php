<?php

declare(strict_types=1);

use Illuminate\Database\ConnectionInterface;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\DB;

/** Read-only database and Laravel-session guards shared by the private runner and its disposable test. */
final class OwnerBootstrapReadiness
{
    public const DATABASE = 'u399215191_dombi_pr_1023';

    public const DATABASE_USER = 'u399215191_dombi_ap_1023';

    public const RELEASE_SHA = 'ea83637aeae57c31d88454149d427d44767df2d8';

    public const AUDIT_MIGRATION = '2026_10_23_000001_create_owner_recovery_audit_logs_table';

    public const AUDIT_MIGRATION_SHA256 = '8103ca5d734524fe450874b4051caa4fbf2f5a93ab4373434384cacd630a762a';

    /** @var list<string> */
    private const PRE_AUDIT_TABLES = [
        'cache', 'cache_locks', 'courier_invitations', 'courier_nomination_reviews', 'courier_outlet_assignments', 'courier_profiles',
        'customer_addresses', 'customer_banners', 'customers', 'deliveries', 'delivery_resolution_logs', 'delivery_status_histories',
        'delivery_tiers', 'exchange_request_items', 'exchange_requests', 'exchange_status_histories', 'failed_jobs', 'favorites', 'job_batches',
        'jobs', 'legacy_product_categories_backup', 'legacy_products_backup', 'migrations', 'notifications', 'offline_sales', 'order_items',
        'order_refund_destinations', 'order_reports', 'order_status_histories', 'orders', 'outlet_audit_logs', 'outlet_holidays',
        'outlet_inventories', 'outlet_operating_hours', 'outlet_payables', 'outlet_product_prices', 'outlets', 'password_reset_tokens',
        'payment_accounts', 'payment_attempts', 'payment_observability_events', 'payment_outbox_events', 'payment_transactions',
        'payment_webhook_logs', 'pricing_audit_logs', 'product_categories', 'product_flavor_groups', 'products', 'push_fcm_tokens',
        'push_subscriptions', 'recipients', 'refund_obligation_backfill_exceptions', 'refund_obligations', 'refund_status_histories',
        'restock_requests', 'restock_request_items', 'return_requests', 'return_request_items', 'return_status_histories', 'sessions',
        'settlement_audit_logs', 'settlement_payment_allocations', 'settlement_payments', 'settlement_reconciliation_issues',
        'settlements', 'stock_movements', 'users',
    ];

    /** @var list<array{0:string,1:string,2:bool,3:string,4:?string,5:?int}> */
    private const AUDIT_COLUMNS = [
        ['id', 'bigint', true, 'NO', null, null],
        ['operation_id', 'char', false, 'NO', null, 36],
        ['user_id', 'bigint', true, 'NO', null, null],
        ['event', 'varchar', false, 'NO', null, 64],
        ['operator', 'varchar', false, 'NO', null, 255],
        ['session_driver', 'varchar', false, 'NO', null, 80],
        ['sessions_revoked', 'int', true, 'NO', '0', null],
        ['created_at', 'timestamp', false, 'NO', null, null],
    ];

    /** @return list<string> */
    public static function expectedTables(): array
    {
        $tables = self::PRE_AUDIT_TABLES;
        $tables[] = 'owner_recovery_audit_logs';
        sort($tables, SORT_STRING);

        return $tables;
    }

    /** @return array{migration_count:int, table_count:int, owner_count:int, business_rows:int, table_fingerprint:string} */
    public static function assertDatabaseReady(
        PDO $pdo,
        string $expectedDatabase,
        string $expectedUser,
        string $releasePath,
        bool $allowExistingApprovedOwner = false,
        bool $verifyLegacyIsolation = true,
    ): array {
        self::assertIdentity($pdo, $expectedDatabase, $expectedUser);

        if ($verifyLegacyIsolation) {
            self::assertLegacyAccessDenied($pdo);
        }

        $migrationFiles = glob(rtrim($releasePath, '/').'/database/migrations/*.php') ?: [];
        $sourceNames = array_map(static fn (string $path): string => pathinfo($path, PATHINFO_FILENAME), $migrationFiles);
        sort($sourceNames, SORT_STRING);
        if (count($sourceNames) !== 165
            || count(array_filter($sourceNames, static fn (string $name): bool => $name === self::AUDIT_MIGRATION)) !== 1
            || hash_file('sha256', rtrim($releasePath, '/').'/database/migrations/'.self::AUDIT_MIGRATION.'.php') !== self::AUDIT_MIGRATION_SHA256) {
            throw new RuntimeException('release_migration_set_or_audit_checksum');
        }

        $baseline = $pdo->query('SELECT migration FROM migrations ORDER BY BINARY migration')->fetchAll(PDO::FETCH_COLUMN);
        $baseline = array_map('strval', $baseline);
        sort($baseline, SORT_STRING);
        if ($baseline !== $sourceNames || count($baseline) !== 165 || count(array_unique($baseline)) !== 165) {
            throw new RuntimeException('migration_ledger_not_exact_165');
        }

        $tables = $pdo->query("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY BINARY TABLE_NAME")
            ->fetchAll(PDO::FETCH_COLUMN);
        $tables = array_map('strval', $tables);
        sort($tables, SORT_STRING);
        $expectedTables = self::expectedTables();
        if ($tables !== $expectedTables || count($tables) !== 68) {
            throw new RuntimeException('table_inventory_not_exact_68');
        }

        self::assertRequiredColumns($pdo);
        self::assertAuditSchema($pdo);
        self::assertRequiredEngines($pdo);

        $users = $pdo->query('SELECT id, name, email, role, is_active, must_change_password FROM users ORDER BY id LIMIT 2')
            ->fetchAll(PDO::FETCH_ASSOC);
        $ownerCount = count($users);
        if ($ownerCount > 1) {
            throw new RuntimeException('unexpected_user_count');
        }
        if ($ownerCount === 1) {
            $owner = $users[0];
            $isApprovedOwner = $owner['name'] === 'Dombi Center'
                && strtolower((string) $owner['email']) === 'dombicenter@gmail.com'
                && $owner['role'] === 'owner'
                && (int) $owner['is_active'] === 1;
            if (! $allowExistingApprovedOwner || ! $isApprovedOwner) {
                throw new RuntimeException('owner_bootstrap_requires_fresh_database');
            }
        }

        $businessRows = 0;
        foreach ($tables as $table) {
            if ($table === 'migrations' || ($table === 'users' && $ownerCount === 1)) {
                continue;
            }
            if (! preg_match('/^[A-Za-z0-9_]+$/', $table)) {
                throw new RuntimeException('unsafe_table_name');
            }
            if ((int) $pdo->query('SELECT COUNT(*) FROM `'.$table.'`')->fetchColumn() !== 0) {
                $businessRows++;
                throw new RuntimeException('unexpected_business_rows');
            }
        }

        return [
            'migration_count' => count($baseline),
            'table_count' => count($tables),
            'owner_count' => $ownerCount,
            'business_rows' => $businessRows,
            'table_fingerprint' => hash('sha256', implode("\n", $expectedTables)."\n"),
        ];
    }

    public static function assertIdentity(PDO $pdo, string $expectedDatabase, string $expectedUser): void
    {
        $identity = $pdo->query('SELECT DATABASE() AS schema_name, CURRENT_USER() AS account_name')->fetch(PDO::FETCH_ASSOC);
        $authenticatedUser = explode('@', (string) ($identity['account_name'] ?? ''), 2)[0];
        if (($identity['schema_name'] ?? null) !== $expectedDatabase || $authenticatedUser !== $expectedUser) {
            throw new RuntimeException('database_identity_mismatch');
        }
    }

    public static function assertSessionHandler(object $app, PDO $guardedPdo, string $expectedDatabase, string $expectedUser): void
    {
        if ($app->environment() !== 'production' || config('app.env') !== 'production') {
            throw new RuntimeException('app_environment_not_production');
        }
        if (config('session.driver') !== 'database' || config('session.table') !== 'sessions') {
            throw new RuntimeException('database_session_configuration_mismatch');
        }

        $defaultConnection = (string) config('database.default');
        $sessionConnection = config('session.connection') ?: $defaultConnection;
        if ($defaultConnection === '' || $sessionConnection !== $defaultConnection || DB::getDefaultConnection() !== $defaultConnection) {
            throw new RuntimeException('session_connection_not_default');
        }

        $connection = DB::connection($defaultConnection);
        if ($connection->getPdo() !== $guardedPdo) {
            throw new RuntimeException('laravel_connection_not_guarded_pdo');
        }

        $sessionStore = $app->make('session')->driver('database');
        $handler = $sessionStore->getHandler();
        if (! $handler instanceof DatabaseSessionHandler) {
            throw new RuntimeException('effective_session_handler_not_database');
        }

        $connectionProperty = new ReflectionProperty(DatabaseSessionHandler::class, 'connection');
        $handlerConnection = $connectionProperty->getValue($handler);
        $tableProperty = new ReflectionProperty(DatabaseSessionHandler::class, 'table');
        $handlerTable = $tableProperty->getValue($handler);
        if ($handlerConnection !== $connection || ! $handlerConnection instanceof ConnectionInterface || $handlerTable !== 'sessions') {
            throw new RuntimeException('session_handler_connection_or_table_mismatch');
        }

        $sessionPdo = $handlerConnection->getPdo();
        if ($sessionPdo !== $guardedPdo) {
            throw new RuntimeException('session_handler_pdo_not_guarded_pdo');
        }
        self::assertIdentity($sessionPdo, $expectedDatabase, $expectedUser);
    }

    public static function assertAuditSchema(PDO $pdo): void
    {
        $rows = $pdo->query("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_recovery_audit_logs' ORDER BY ORDINAL_POSITION")
            ->fetchAll(PDO::FETCH_ASSOC);
        $actual = [];
        foreach ($rows as $row) {
            $columnType = strtolower((string) $row['COLUMN_TYPE']);
            $actual[] = [
                (string) $row['COLUMN_NAME'],
                strtolower((string) $row['DATA_TYPE']),
                str_contains($columnType, 'unsigned'),
                strtoupper((string) $row['IS_NULLABLE']),
                $row['COLUMN_DEFAULT'] === null ? null : (string) $row['COLUMN_DEFAULT'],
                $row['CHARACTER_MAXIMUM_LENGTH'] === null ? null : (int) $row['CHARACTER_MAXIMUM_LENGTH'],
            ];
        }
        if ($actual !== self::AUDIT_COLUMNS) {
            throw new RuntimeException('audit_columns_mismatch');
        }

        $indexes = $pdo->query("SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_list FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_recovery_audit_logs' GROUP BY INDEX_NAME, NON_UNIQUE ORDER BY BINARY INDEX_NAME")
            ->fetchAll(PDO::FETCH_ASSOC);
        $actualIndexes = [];
        foreach ($indexes as $index) {
            $actualIndexes[(string) $index['INDEX_NAME']] = [(int) $index['NON_UNIQUE'], (string) $index['columns_list']];
        }
        $expectedIndexes = [
            'PRIMARY' => [0, 'id'],
            'owner_recovery_audit_logs_operation_id_unique' => [0, 'operation_id'],
            'owner_recovery_audit_logs_user_id_created_at_index' => [1, 'user_id,created_at'],
        ];
        ksort($actualIndexes, SORT_STRING);
        ksort($expectedIndexes, SORT_STRING);
        if ($actualIndexes !== $expectedIndexes) {
            throw new RuntimeException('audit_indexes_mismatch');
        }

        $foreignKeys = $pdo->query("SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r USING (CONSTRAINT_SCHEMA, CONSTRAINT_NAME) WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'owner_recovery_audit_logs' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY BINARY k.CONSTRAINT_NAME")
            ->fetchAll(PDO::FETCH_ASSOC);
        if (count($foreignKeys) !== 1
            || $foreignKeys[0]['COLUMN_NAME'] !== 'user_id'
            || $foreignKeys[0]['REFERENCED_TABLE_NAME'] !== 'users'
            || $foreignKeys[0]['REFERENCED_COLUMN_NAME'] !== 'id'
            || strtoupper((string) $foreignKeys[0]['DELETE_RULE']) !== 'RESTRICT') {
            throw new RuntimeException('audit_foreign_key_mismatch');
        }
    }

    private static function assertLegacyAccessDenied(PDO $pdo): void
    {
        foreach (['u399215191_app', 'u399215191_dombi_staging'] as $database) {
            try {
                $pdo->query('SELECT 1 FROM `'.$database.'`.migrations LIMIT 0');
                throw new RuntimeException('legacy_database_accessible');
            } catch (PDOException $exception) {
                $errorCode = (int) ($exception instanceof PDOException ? ($exception->errorInfo[1] ?? 0) : 0);
                if (! in_array($errorCode, [1044, 1142], true)) {
                    throw new RuntimeException('legacy_database_denial_unproven');
                }
            } catch (RuntimeException $exception) {
                throw $exception;
            } catch (Throwable $exception) {
                throw new RuntimeException('legacy_database_denial_unproven');
            }
        }
    }

    private static function assertRequiredColumns(PDO $pdo): void
    {
        $rows = $pdo->query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'sessions' AND COLUMN_NAME IN ('id', 'user_id', 'payload', 'last_activity')) OR (TABLE_NAME = 'users' AND COLUMN_NAME IN ('id', 'name', 'email', 'password', 'role', 'is_active', 'must_change_password')) OR (TABLE_NAME = 'migrations' AND COLUMN_NAME IN ('id', 'migration', 'batch')))")
            ->fetchAll(PDO::FETCH_ASSOC);
        $found = [];
        foreach ($rows as $row) {
            $found[(string) $row['TABLE_NAME']][(string) $row['COLUMN_NAME']] = true;
        }
        foreach ([
            'sessions' => ['id', 'user_id', 'payload', 'last_activity'],
            'users' => ['id', 'name', 'email', 'password', 'role', 'is_active', 'must_change_password'],
            'migrations' => ['id', 'migration', 'batch'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                if (! isset($found[$table][$column])) {
                    throw new RuntimeException('required_schema_column_missing');
                }
            }
        }

        $emailUnique = (int) $pdo->query("SELECT COUNT(*) FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_email_unique' AND NON_UNIQUE = 0 AND COLUMN_NAME = 'email'")->fetchColumn();
        if ($emailUnique !== 1) {
            throw new RuntimeException('users_email_unique_index_missing');
        }
    }

    private static function assertRequiredEngines(PDO $pdo): void
    {
        $engines = $pdo->query("SELECT TABLE_NAME, ENGINE FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('migrations', 'sessions', 'users', 'owner_recovery_audit_logs')")
            ->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach (['migrations', 'sessions', 'users', 'owner_recovery_audit_logs'] as $table) {
            if (strtolower((string) ($engines[$table] ?? '')) !== 'innodb') {
                throw new RuntimeException('required_table_engine_not_innodb');
            }
        }
    }
}
