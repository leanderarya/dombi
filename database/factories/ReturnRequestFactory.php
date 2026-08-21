<?php

namespace Database\Factories;

use App\Models\Outlet;
use App\Models\ReturnRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReturnRequestFactory extends Factory
{
    protected $model = ReturnRequest::class;

    public function definition(): array
    {
        return [
            'outlet_id' => Outlet::factory(),
            'requested_by' => User::factory(),
            'status' => ReturnRequest::STATUS_SUBMITTED,
            'reason' => 'slow_moving',
        ];
    }
}
