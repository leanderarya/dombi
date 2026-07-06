<?php

namespace App\Http\Requests\Outlet;

use App\Services\OrderStatusService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    private const OUTLET_ALLOWED_STATUSES = [
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'cancelled_by_outlet',
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
            'reason' => ['required_if:status,cancelled_by_outlet', 'nullable', 'string', 'max:500'],
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

                if ($status === 'cancelled_by_outlet' && $this->input('reason')) {
                    if (! in_array($this->input('reason'), OrderStatusService::outletCancellationReasons(), true)) {
                        $this->validator->errors()->add('reason', 'Alasan pembatalan tidak valid.');
                    }
                }
            },
        ];
    }
}
