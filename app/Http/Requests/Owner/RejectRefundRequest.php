<?php

namespace App\Http\Requests\Owner;

use App\Enums\RefundRejectionReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RejectRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(RefundRejectionReason::class)],
            'note' => ['nullable', 'string', 'max:500', 'required_if:reason,other'],
            'legacy_repair' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'note' => trim((string) $this->input('note')),
        ]);
    }
}
