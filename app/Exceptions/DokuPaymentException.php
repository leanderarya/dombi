<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\Client\Response;

class DokuPaymentException extends Exception
{
    public function __construct(
        string $message,
        public readonly int $responseCode = 0,
        public readonly array $errors = [],
        public readonly ?Response $original = null,
    ) {
        parent::__construct($message);
    }

    /**
     * Get validation error messages from DOKU.
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Get the original HTTP response.
     */
    public function getOriginalResponse(): ?Response
    {
        return $this->original;
    }

    /**
     * Get a formatted error message for user display.
     */
    public function getUserMessage(): string
    {
        if (! empty($this->errors)) {
            return implode(', ', $this->errors);
        }

        return $this->message;
    }
}
