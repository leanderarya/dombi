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
            'resolution_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
