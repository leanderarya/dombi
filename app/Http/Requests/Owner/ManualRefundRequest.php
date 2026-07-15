<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class ManualRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'refund_amount' => ['required', 'numeric', 'min:1'],
            'refund_reason' => ['required', 'string', 'max:255'],
            'proof' => ['required', 'image', 'max:2048'],
        ];
    }
}
