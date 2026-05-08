<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDeliveryStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $delivery = $this->route('delivery');

        return $this->user()?->isCourier() && $delivery?->courier_id === $this->user()->id;
    }

    public function rules(): array
    {
        return [];
    }
}
