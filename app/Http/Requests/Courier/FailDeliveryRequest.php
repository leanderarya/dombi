<?php

namespace App\Http\Requests\Courier;

class FailDeliveryRequest extends UpdateDeliveryStatusRequest
{
    public function rules(): array
    {
        return [
            'failed_reason' => ['required', 'string', 'min:5'],
        ];
    }
}
