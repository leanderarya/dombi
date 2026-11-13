<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/** @deprecated Owner creation now has one entry point: ProductionOwnerSeeder via the guarded private runner. */
class BootstrapInitialOwner extends Command
{
    protected $signature = 'dombi:bootstrap-owner';

    protected $description = 'Retired entry point; use the separately authorized ProductionOwnerSeeder runner.';

    public function handle(): int
    {
        $this->error('This owner creation command is retired. No changes were made.');

        return self::FAILURE;
    }
}
