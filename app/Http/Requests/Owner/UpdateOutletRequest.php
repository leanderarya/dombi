<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOutletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('outlets', 'name')->ignore($this->route('outlet'))],
            'kelurahan' => ['sometimes', 'required', 'string', 'max:255'],
            'kecamatan' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'province' => ['sometimes', 'nullable', 'string', 'max:255'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string'],
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pic_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pic_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pic_position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'operational_notes' => ['sometimes', 'nullable', 'string'],
            'delivery_radius_km' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100'],
            'prep_estimate_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:240'],
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive', 'temporarily_closed', 'maintenance', 'archived'])],
        ];
    }
}
