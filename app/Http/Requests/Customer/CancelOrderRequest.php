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

        return (bool) $order && $order->customer_id === $this->user()?->id;
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
