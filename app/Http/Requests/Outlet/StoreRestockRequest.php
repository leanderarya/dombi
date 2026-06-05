<?php

namespace App\Http\Requests\Outlet;

use Illuminate\Foundation\Http\FormRequest;

class StoreRestockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->outlet;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'exists:product_variants,id'],
            'items.*.requested_quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
