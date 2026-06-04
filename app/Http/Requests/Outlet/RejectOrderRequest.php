<?php

namespace App\Http\Requests\Outlet;

use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RejectOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');
        $outlet = $this->user()?->outlet;

        return (bool) $outlet && $order?->outlet_id === $outlet->id;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in(OrderStatusService::rejectionReasons())],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan penolakan wajib dipilih.',
            'reason.in' => 'Alasan penolakan tidak valid.',
        ];
    }
}
