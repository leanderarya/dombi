<?php

namespace App\Http\Requests\Outlet;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmDistributionReceivedRequest extends FormRequest
{
    public function authorize(): bool
    {
        $distribution = $this->route('distribution');

        return $this->user()?->outlet?->id === $distribution?->outlet_id;
    }

    public function rules(): array
    {
        return [
            'received_notes' => ['nullable', 'string', 'max:500'],
            'damage_notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
