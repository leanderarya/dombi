<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Recipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecipientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $customer = $request->user()?->customer;

        if (! $customer) {
            return response()->json(['recipients' => []]);
        }

        $recipients = $customer->recipients()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Recipient $r) => [
                'id' => $r->id,
                'label' => $r->label,
                'name' => $r->name,
                'phone' => $r->phone,
                'address_line' => $r->address_line,
                'latitude' => $r->latitude,
                'longitude' => $r->longitude,
                'is_default' => $r->is_default,
            ]);

        return response()->json(['recipients' => $recipients]);
    }

    public function store(Request $request): JsonResponse
    {
        $customer = $request->user()?->customer;

        if (! $customer) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
            'address_line' => ['nullable', 'string', 'max:1000'],
            'address_detail' => ['nullable', 'string', 'max:500'],
            'province' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'landmark' => ['nullable', 'string', 'max:500'],
            'delivery_notes' => ['nullable', 'string', 'max:1000'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        // If setting as default, unset other defaults
        if (! empty($validated['is_default'])) {
            $customer->recipients()->where('is_default', true)->update(['is_default' => false]);
        }

        $recipient = $customer->recipients()->create($validated);

        return response()->json([
            'recipient' => [
                'id' => $recipient->id,
                'label' => $recipient->label,
                'name' => $recipient->name,
                'phone' => $recipient->phone,
                'address_line' => $recipient->address_line,
                'latitude' => $recipient->latitude,
                'longitude' => $recipient->longitude,
                'is_default' => $recipient->is_default,
            ],
        ], 201);
    }

    public function update(Request $request, Recipient $recipient): JsonResponse
    {
        $customer = $request->user()?->customer;

        if (! $customer || $recipient->customer_id !== $customer->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'name' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:20'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        if (! empty($validated['is_default'])) {
            $customer->recipients()->where('is_default', true)->where('id', '!=', $recipient->id)->update(['is_default' => false]);
        }

        $recipient->update($validated);

        return response()->json(['recipient' => $recipient->fresh()]);
    }

    public function destroy(Request $request, Recipient $recipient): JsonResponse
    {
        $customer = $request->user()?->customer;

        if (! $customer || $recipient->customer_id !== $customer->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $recipient->delete();

        return response()->json(['deleted' => true]);
    }
}
