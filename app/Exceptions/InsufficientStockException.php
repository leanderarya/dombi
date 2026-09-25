<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly int $outletId,
        public readonly ?int $productId,
        public readonly string $stockType,
        public readonly int $required,
        public readonly int $available,
        string $message = '',
    ) {
        parent::__construct($message ?: "Insufficient {$stockType}: required {$required}, available {$available} (outlet={$outletId}, product={$productId})");
    }

    /**
     * The owner controllers catch this to return their own wording. Without a
     * handler here anything else that hits it - completing a delivery, for one -
     * answered with a bare 500 and showed the user nothing at all.
     */
    public function render(Request $request): JsonResponse|RedirectResponse
    {
        $message = 'Stok tidak mencukupi untuk menyelesaikan proses ini. Silakan hubungi outlet.';

        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 422);
        }

        return back()->with('error', $message);
    }
}
