<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CancelOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() === true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in([
                'Stok Tidak Tersedia',
                'Produk Rusak',
                'Outlet Tutup',
                'Gangguan Operasional',
                'Permintaan Customer',
                'Lainnya',
            ])],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
