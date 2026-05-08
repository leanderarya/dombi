<?php

namespace App\Http\Requests\Outlet;

use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
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
            'status' => ['required', 'string', Rule::in(OrderStatusService::validStatuses())],
        ];
    }
}
