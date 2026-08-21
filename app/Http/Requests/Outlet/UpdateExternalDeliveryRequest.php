<?php

namespace App\Http\Requests\Outlet;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExternalDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $delivery = $this->route('delivery');
        $outlet = $this->user()?->outlet;

        return $this->user()?->isOutlet()
            && $delivery?->courier_type === 'eksternal'
            && $outlet?->id === $delivery?->order?->outlet_id;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                'picked_up',
                'delivering',
                'completed',
                'failed',
                'returned_to_outlet',
            ])],
            'reason' => [
                'nullable',
                'string',
                'max:1000',
                Rule::requiredIf(fn () => in_array(
                    $this->input('status'),
                    ['failed', 'returned_to_outlet'],
                    true,
                )),
            ],
        ];
    }
}
