<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class BulkStoreSizeProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'flavor' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'sizes' => ['required', 'array', 'min:1'],
            'sizes.*.size' => ['required', 'string', 'max:50'],
            'sizes.*.center_price' => ['required', 'numeric', 'min:0'],
            'sizes.*.selling_price' => ['required', 'numeric', 'gte:sizes.*.center_price'],
            'sizes.*.sku' => ['nullable', 'string', 'max:50', 'distinct'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ];
    }
}
