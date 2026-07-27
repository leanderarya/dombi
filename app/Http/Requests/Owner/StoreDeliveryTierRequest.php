<?php

namespace App\Http\Requests\Owner;

use App\Models\DeliveryTier;
use Illuminate\Foundation\Http\FormRequest;

class StoreDeliveryTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'min_km' => ['required', 'numeric', 'min:0'],
            'max_km' => ['required', 'numeric', 'gt:min_km'],
            'fee' => ['required', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [
            function ($validator): void {
                $tierId = $this->route('delivery_tier');
                $tierId = is_object($tierId) ? $tierId->getKey() : $tierId;

                $overlap = DeliveryTier::query()
                    ->where('is_active', true)
                    ->when($tierId, fn ($query, $id) => $query->whereKeyNot($id))
                    ->where('min_km', '<', (float) $this->input('max_km'))
                    ->where('max_km', '>', (float) $this->input('min_km'))
                    ->exists();

                if ($overlap) {
                    $validator->errors()->add(
                        'min_km',
                        'Rentang jarak bertumpang tindih dengan tier aktif lain.',
                    );
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'max_km.gt' => 'Jarak maksimal harus lebih besar dari jarak minimal.',
        ];
    }
}
