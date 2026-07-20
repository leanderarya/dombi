<?php

namespace App\Jobs;

use App\Models\Customer;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;

class PushNotificationJob implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct(
        public ?User $user,
        public ?Customer $customer,
        public string $title,
        public string $body,
        public array $data = [],
    ) {}

    public function handle(PushNotificationService $push): void
    {
        if ($this->user) {
            $push->send($this->user, $this->title, $this->body, $this->data);
            return;
        }

        if ($this->customer) {
            $user = $this->customer->user;
            if ($user) {
                $push->send($user, $this->title, $this->body, $this->data);
            }
        }
    }
}
