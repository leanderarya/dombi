<?php

namespace App\Exceptions;

use Exception;

class RegisteredPhoneException extends Exception
{
    public function __construct(
        public readonly string $phone,
    ) {
        parent::__construct("Nomor {$phone} sudah terdaftar. Silakan masuk untuk melanjutkan.");
    }
}
