<?php

namespace App\Http\Requests\Owner;

use App\Models\Delivery;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResolveDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() === true;
    }

    public function rules(): array
    {
        return [
            'resolution' => ['required', 'string', Rule::in(Delivery::RESOLUTION_STATUSES)],
            'resolution_notes' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'resolution_notes.required' => 'Catatan operasional wajib diisi untuk audit trail.',
            'resolution_notes.min' => 'Catatan minimal 5 karakter.',
        ];
    }
}
