<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOutletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('outlets', 'name')->ignore($this->route('outlet'))],
            'kelurahan' => ['required', 'string', 'max:255'],
            'kecamatan' => ['required', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'phone' => ['nullable', 'string', 'max:50'],
            'pic_name' => ['nullable', 'string', 'max:255'],
            'pic_phone' => ['nullable', 'string', 'max:50'],
            'pic_position' => ['nullable', 'string', 'max:255'],
            'operational_notes' => ['nullable', 'string'],
            'delivery_radius_km' => ['nullable', 'integer', 'min:1', 'max:100'],
            'prep_estimate_minutes' => ['nullable', 'integer', 'min:1', 'max:240'],
            'status' => ['required', Rule::in(['active', 'inactive', 'temporarily_closed', 'maintenance', 'archived'])],
        ];
    }
}
