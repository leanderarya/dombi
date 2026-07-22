<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignCourierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $order = $this->route('order');

        if (! $user || ! $order || $order->status !== 'ready_for_pickup') {
            return false;
        }

        if ($user->isOwner()) {
            return true;
        }

        if ($user->isOutlet()) {
            return $user->outlet?->id === $order->outlet_id;
        }

        return false;
    }

    public function rules(): array
    {
        return [
            'courier_type' => ['required', 'in:dombi,eksternal'],
            'courier_id' => [
                'required_if:courier_type,dombi',
                Rule::exists('users', 'id')->where('role', 'courier')->where('is_active', true)->where('is_online', true),
            ],
            'external_courier_name' => ['required_if:courier_type,eksternal', 'string', 'max:100'],
            'external_courier_phone' => ['nullable', 'string', 'max:20'],
            'external_plate_number' => ['nullable', 'string', 'max:20'],
            'courier_cost' => ['required_if:courier_type,eksternal', 'numeric', 'min:0'],
        ];
    }
}
