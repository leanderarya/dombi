<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE delivery_resolution_logs DROP FOREIGN KEY delivery_resolution_logs_resolved_by_foreign');
        DB::statement('ALTER TABLE delivery_resolution_logs ADD CONSTRAINT delivery_resolution_logs_resolved_by_foreign FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE RESTRICT');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE delivery_resolution_logs DROP FOREIGN KEY delivery_resolution_logs_resolved_by_foreign');
        DB::statement('ALTER TABLE delivery_resolution_logs ADD CONSTRAINT delivery_resolution_logs_resolved_by_foreign FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE CASCADE');
    }
};
