<?php

namespace App\Exceptions;

use Exception;

class DeliveryException extends Exception
{
    public function getUserMessage(): string
    {
        return $this->getMessage();
    }
}
