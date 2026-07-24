<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->recipientQuery($request);

        $notifications = (clone $query)->latest()->limit(50)->get();
        $unreadCount = (clone $query)->unread()->count();

        return response()->json([
            'notifications' => $notifications->map(fn (Notification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'title' => $n->title,
                'message' => $n->message,
                'data' => $n->data,
                'read_at' => $n->read_at?->toISOString(),
                'created_at' => $n->created_at->toISOString(),
                'time_ago' => $n->created_at->diffForHumans(),
            ]),
            'unread_count' => $unreadCount,
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $query = $this->recipientQuery($request);

        $unreadCount = (clone $query)->unread()->count();

        $response = ['unread_count' => $unreadCount];

        if ($request->filled('since_id')) {
            $latest = (clone $query)
                ->where('id', '>', $request->integer('since_id'))
                ->latest()
                ->limit(5)
                ->get(['id', 'title', 'message', 'entity_type', 'entity_id']);

            $response['latest'] = $latest;
        }

        return response()->json($response);
    }

    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        $user = $request->user();

        if ($user->isCustomer()) {
            $customer = $user->customer;
            if (! $customer || $notification->customer_id !== $customer->id) {
                abort(403);
            }
        } elseif ($notification->user_type !== $user->role || $notification->user_id !== $user->id) {
            abort(403);
        }

        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $query = $this->recipientQuery($request);
        (clone $query)->unread()->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    private function recipientQuery(Request $request): Builder
    {
        $user = $request->user();

        if ($user->isCustomer()) {
            $customer = $user->customer;
            if ($customer) {
                return Notification::query()
                    ->where('user_type', 'customer')
                    ->where('customer_id', $customer->id);
            }
        }

        return Notification::query()
            ->where('user_type', $user->role)
            ->where('user_id', $user->id);
    }
}
