<?php

namespace App\Http\Requests\Outlet;

use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    /**
     * Statuses that an outlet user is allowed to transition to.
     */
    private const OUTLET_ALLOWED_STATUSES = [
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'cancelled',
    ];

    public function authorize(): bool
    {
        $order = $this->route('order');
        $outlet = $this->user()?->outlet;

        return (bool) $outlet && $order?->outlet_id === $outlet->id;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(self::OUTLET_ALLOWED_STATUSES)],
        ];
    }

    public function after(): array
    {
        return [
            function (): void {
                $order = $this->route('order');
                $status = $this->input('status');

                if ($order && $status) {
                    $orderStatusService = app(OrderStatusService::class);
                    if (! $orderStatusService->canTransition($order->status, $status)) {
                        $this->validator->errors()->add(
                            'status',
                            "Status order tidak bisa diubah dari {$order->status} ke {$status}."
                        );
                    }
                }
            },
        ];
    }
}
