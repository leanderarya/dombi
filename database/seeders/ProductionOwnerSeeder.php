<?php

namespace Database\Seeders;

use App\Services\ProductionOwnerProvisioner;
use Illuminate\Database\Seeder;
use RuntimeException;

/** Dedicated guarded entry point for creating the approved first production owner. */
class ProductionOwnerSeeder extends Seeder
{
    public function run(): void
    {
        $credentialDirectory = getenv('DOMBI_OWNER_CREDENTIAL_DIR');
        if (! is_string($credentialDirectory) || $credentialDirectory === '') {
            throw new RuntimeException('Private owner credential directory is not configured.');
        }

        app(ProductionOwnerProvisioner::class)->seed($credentialDirectory);
    }
}
