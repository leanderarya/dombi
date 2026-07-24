<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class CompleteManualRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'proof' => ['required', 'image', 'max:2048'],
            'transfer_reference' => ['nullable', 'string', 'max:255'],
            'transfer_note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
