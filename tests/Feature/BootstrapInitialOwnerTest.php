<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class BootstrapInitialOwnerTest extends TestCase
{
    public function test_retired_bootstrap_command_cannot_create_an_owner(): void
    {
        $this->assertSame(1, Artisan::call('dombi:bootstrap-owner'));
        $this->assertSame('This owner creation command is retired. No changes were made.'.PHP_EOL, Artisan::output());
    }
}
