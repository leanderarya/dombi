<?php

namespace App\Http\Controllers\Owner;

use App\Enums\RefundRejectionReason;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\UpdateRefundDestinationRequest;
use App\Http\Requests\Owner\RejectRefundRequest;
use App\Http\Requests\Owner\RollbackRefundRequest;
use App\Models\Order;
use App\Services\RefundService;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class RefundController extends Controller
{
    public function index(): RedirectResponse
    {
        $filter = request()->query('filter', 'ready');

        $validFilters = ['awaiting_customer', 'awaiting_guest', 'ready', 'in_progress', 'action_required', 'completed', 'rejected'];
        if (! in_array($filter, $validFilters, true)) {
            $filter = 'ready';
        }

        return redirect()->route('owner.finance.dashboard', ['tab' => 'refund', 'filter' => $filter]);
    }

    public function destination(UpdateRefundDestinationRequest $request, Order $order, RefundService $refunds): RedirectResponse
    {
        $validated = $request->validated();

        if (! $request->boolean('phone_verified')) {
            return back()->with('error', 'Verifikasi nomor telepon diperlukan.');
        }

        try {
            $refunds->submitDestination(
                $order,
                $validated['destination_type'],
                'owner',
                $request->user()->id,
                $validated,
            );

            return back()->with('success', 'Tujuan refund berhasil disimpan.');
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function start(Order $order, RefundService $refunds): RedirectResponse
    {
        try {
            $refunds->start($order, auth()->id());

            return back()->with('success', 'Proses refund dimulai.');
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function reject(Order $order, RejectRefundRequest $request, RefundService $refunds): RedirectResponse
    {
        $validated = $request->validated();

        try {
            $refunds->reject(
                $order,
                $validated['reason'],
                $validated['note'] ?? null,
                'owner',
                $request->user()->id,
                $validated['legacy_repair'] ?? false,
            );

            return back()->with('success', 'Refund ditolak.');
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function rollback(Order $order, RollbackRefundRequest $request, RefundService $refunds): RedirectResponse
    {
        $validated = $request->validated();

        try {
            $refunds->rollback($order, $request->user()->id, $validated['mode'], $validated['reason']);

            return back()->with('success', 'Refund dikembalikan ke antrean.');
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function complete(Order $order, \App\Http\Requests\Owner\CompleteManualRefundRequest $request, RefundService $refunds): RedirectResponse
    {
        try {
            $relative = $request->file('proof')->store("refund-proofs/{$order->id}", 'local');
            if ($relative === false) {
                return back()->with('error', 'Gagal menyimpan bukti refund.');
            }

            $persisted = "private:{$relative}";

            $refunds->complete(
                $order,
                $request->user()->id,
                $persisted,
                $request->input('transfer_reference'),
                $request->input('transfer_note'),
            );

            return back()->with('success', 'Refund ditandai selesai.');
        } catch (DomainException $e) {
            Storage::disk('local')->delete($relative ?? '');

            return back()->with('error', $e->getMessage());
        }
    }
}
