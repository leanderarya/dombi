<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Storage;

class RefundProofController extends Controller
{
    public function __invoke(Request $request, Order $order): StreamedResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        if ($user->isOwner()) {
            // Owner can view any refund proof
        } elseif ($user->isCustomer()) {
            if ($order->customer?->user_id !== $user->id) {
                abort(403);
            }
        } else {
            abort(403);
        }

        if ($order->payment_status !== 'refunded' || ! $order->refund_proof_image) {
            abort(404);
        }

        $path = $order->refund_proof_image;

        if (str_starts_with($path, 'private:')) {
            $diskPath = substr($path, strlen('private:'));
            $disk = Storage::disk('local');

            if (! $disk->exists($diskPath)) {
                abort(404);
            }

            $extension = pathinfo($diskPath, PATHINFO_EXTENSION);
            $safeName = "refund-{$order->order_code}.{$extension}";

            return $disk->response($diskPath, $safeName, [
                'Content-Disposition' => 'inline; filename="'.$safeName.'"',
            ]);
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            abort(404);
        }

        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $safeName = "refund-{$order->order_code}.{$extension}";

        return $disk->response($path, $safeName, [
            'Content-Disposition' => 'inline; filename="'.$safeName.'"',
        ]);
    }
}
