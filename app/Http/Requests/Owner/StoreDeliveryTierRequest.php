<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeliveryTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'min_km' => ['required', 'numeric', 'min:0'],
            'max_km' => ['required', 'numeric', 'gt:min_km'],
            'fee' => ['required', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'max_km.gt' => 'Jarak maksimal harus lebih besar dari jarak minimal.',
        ];
    }
}
