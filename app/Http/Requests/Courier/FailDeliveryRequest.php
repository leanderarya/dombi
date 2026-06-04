<?php

namespace App\Http\Requests\Courier;

use Illuminate\Validation\Rule;

class FailDeliveryRequest extends UpdateDeliveryStatusRequest
{
    public const FAILURE_REASONS = [
        'Customer Tidak Ditemukan',
        'Penerima Tidak Ada',
        'Alamat Tidak Jelas',
        'Menolak Pesanan',
        'Kendala Operasional',
        'Lainnya',
    ];

    public function rules(): array
    {
        return [
            'failed_reason' => ['required', 'string', Rule::in(self::FAILURE_REASONS)],
            'failure_note' => [
                'nullable',
                'string',
                'max:1000',
                Rule::requiredIf(fn () => $this->input('failed_reason') === 'Lainnya'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'failed_reason.required' => 'Pilih alasan kegagalan.',
            'failed_reason.in' => 'Alasan kegagalan tidak valid.',
            'failure_note.required' => 'Catatan wajib diisi jika memilih "Lainnya".',
        ];
    }
}
