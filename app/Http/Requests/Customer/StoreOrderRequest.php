<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return ! $this->user() || $this->user()->isCustomer();
    }

    public function rules(): array
    {
        $addressRule = $this->user()?->isCustomer()
            ? Rule::exists('customer_addresses', 'id')->where('user_id', $this->user()->id)
            : 'prohibited';

        return [
            'address_id' => [
                'nullable',
                $addressRule,
            ],
            'customer_name' => ['required_without:address_id', 'nullable', 'string', 'min:3', 'max:255'],
            'phone_number' => ['required_without:address_id', 'nullable', 'string', 'max:20'],
            'address_line' => ['required_without:address_id', 'nullable', 'string', 'max:1000'],
            'province' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'house_number' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required_without:address_id', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_without:address_id', 'nullable', 'numeric', 'between:-180,180'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'delivery_notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', Rule::exists('products', 'id')->where('is_active', true)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('phone_number')) {
            $this->merge([
                'phone_number' => $this->normalizeIndonesianPhone((string) $this->input('phone_number')),
            ]);
        }
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $phone = (string) $this->input('phone_number');

                if ($phone !== '' && ! preg_match('/^62[0-9]{9,13}$/', $phone)) {
                    $validator->errors()->add('phone_number', 'Nomor WhatsApp harus menggunakan format Indonesia yang valid.');
                }

                if (! $this->filled('address_id') && (! $this->filled('latitude') || ! $this->filled('longitude'))) {
                    $validator->errors()->add('latitude', 'Pilih dan konfirmasi lokasi pengiriman pada peta.');
                }
            },
        ];
    }

    private function normalizeIndonesianPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }
}
