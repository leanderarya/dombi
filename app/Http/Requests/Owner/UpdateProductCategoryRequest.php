<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        $categoryId = $this->route('product_category') ?? $this->route('productCategory') ?? $this->route('category') ?? $this->route('id');

        // Handle route model binding (ProductCategory model instance)
        if (is_object($categoryId) && isset($categoryId->id)) {
            $categoryId = $categoryId->id;
        }

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('product_categories', 'name')->ignore($categoryId)],
            'brand' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
