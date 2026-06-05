<?php

namespace App\Http\Requests\Customer;

use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CancelOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');
        $user = $this->user();

        if (! $order) {
            return false;
        }

        // Authenticated customer must own the order
        if ($user && $user->isCustomer()) {
            return $order->customer_id === $user->customer?->id;
        }

        return false;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in(OrderStatusService::cancellationReasons())],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan pembatalan wajib dipilih.',
            'reason.in' => 'Alasan pembatalan tidak valid.',
        ];
    }
}
