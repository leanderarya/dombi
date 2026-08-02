<?php

namespace App\Http\Requests\Outlet;

use Illuminate\Foundation\Http\FormRequest;

class StoreCourierNominationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->outlet !== null;
    }

    public function rules(): array
    {
        $resubmitting = $this->route('profile') !== null;

        $photoRules = $resubmitting
            ? ['nullable', 'image', 'mimes:jpeg,png,webp', 'max:5120']
            : ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'];

        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'vehicle_plate' => ['required', 'string', 'max:20'],
            'face_photo' => $photoRules,
            'vehicle_photo' => $photoRules,
        ];
    }

    public function messages(): array
    {
        return [
            'face_photo.required' => 'Foto wajah wajib diunggah.',
            'vehicle_photo.required' => 'Foto kendaraan wajib diunggah.',
            'face_photo.max' => 'Foto wajah maksimal 5 MB.',
            'vehicle_photo.max' => 'Foto kendaraan maksimal 5 MB.',
        ];
    }
}
