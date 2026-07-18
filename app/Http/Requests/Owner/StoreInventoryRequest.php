<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'outlet_id' => ['required', 'exists:outlets,id'],
            'product_variant_id' => ['required', 'exists:product_variants,id'],
            'current_stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'minimum_stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
