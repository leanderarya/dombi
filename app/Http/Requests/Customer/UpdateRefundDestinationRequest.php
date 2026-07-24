<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRefundDestinationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');
        $user = $this->user();

        return $order && $user && $user->isCustomer()
            && $order->customer_id === $user->getCustomerOrCreate()->id;
    }

    public function rules(): array
    {
        return [
            'destination_type' => ['required', Rule::in(['bank', 'ewallet'])],
            'bank_name' => ['nullable', 'string', 'max:100', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'account_number' => ['nullable', 'string', 'max:50', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'account_holder' => ['nullable', 'string', 'max:100', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'ewallet_provider' => ['nullable', 'string', 'max:100', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
            'ewallet_number' => ['nullable', 'string', 'max:50', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
            'ewallet_holder' => ['nullable', 'string', 'max:100', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
        ];
    }
}
