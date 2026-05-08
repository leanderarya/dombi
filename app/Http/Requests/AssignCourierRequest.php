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
            'courier_id' => [
                'required',
                Rule::exists('users', 'id')->where('role', 'courier')->where('is_active', true),
            ],
        ];
    }
}
