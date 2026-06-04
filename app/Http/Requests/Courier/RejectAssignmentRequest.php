<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RejectAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $delivery = $this->route('delivery');

        return $this->user()?->isCourier() && $delivery?->courier_id === $this->user()->id;
    }

    public function rules(): array
    {
        return [
            'rejection_reason' => ['required', 'string', Rule::in(config('delivery.rejection_reasons', []))],
            'rejection_note' => [
                'nullable',
                'string',
                'max:1000',
                Rule::requiredIf(fn () => $this->input('rejection_reason') === 'Lainnya'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'rejection_reason.required' => 'Pilih alasan penolakan.',
            'rejection_reason.in' => 'Alasan penolakan tidak valid.',
            'rejection_note.required' => 'Catatan wajib diisi jika memilih "Lainnya".',
        ];
    }
}
