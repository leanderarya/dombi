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

        if (! $order || ! $user) {
            return false;
        }

        if ($user->isOwner()) {
            return $order->customer?->user_id === null;
        }

        return $user->isCustomer()
            && $order->customer?->user_id === $user->id
            && $order->customer_id === $user->getCustomerOrCreate()->id;
    }

    public function rules(): array
    {
        // Numbers are transferred by hand, so a free-text value like "-" or
        // "abc" must never reach the point of being paid out to.
        // ponytail: the two forms mirror this with pattern="[0-9]*" + maxLength;
        // this regex stays the authority.
        return [
            'destination_type' => ['required', Rule::in(['bank', 'ewallet'])],
            'bank_name' => ['nullable', 'string', 'min:2', 'max:100', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'account_number' => ['nullable', 'string', 'regex:/^[0-9]{6,30}$/', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'account_holder' => ['nullable', 'string', 'min:2', 'max:100', 'required_if:destination_type,bank', 'prohibited_unless:destination_type,bank'],
            'ewallet_provider' => ['nullable', 'string', 'min:2', 'max:100', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
            'ewallet_number' => ['nullable', 'string', 'regex:/^[0-9]{6,30}$/', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
            'ewallet_holder' => ['nullable', 'string', 'min:2', 'max:100', 'required_if:destination_type,ewallet', 'prohibited_unless:destination_type,ewallet'],
        ];
    }

    public function messages(): array
    {
        return [
            'account_number.regex' => 'Nomor rekening harus berupa 6-30 digit angka.',
            'ewallet_number.regex' => 'Nomor e-wallet harus berupa 6-30 digit angka.',
        ];
    }

    public function actorType(): string
    {
        return $this->user()->isOwner() ? 'owner' : 'customer';
    }
}
