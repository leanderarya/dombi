<?php

namespace App\Http\Requests\Customer;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;

class GuestCancelOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');
        $token = $this->route('token');

        if (! $order || ! $token) {
            return false;
        }

        if (! $order instanceof Order) {
            $order = Order::find($order);
        }

        if (! $order || ! $order->guest_token) {
            return false;
        }

        return hash_equals((string) $order->guest_token, (string) $token);
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'in:' . implode(',', OrderStatusService::cancellationReasons())],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
