<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class ApproveRestockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.restock_request_item_id' => ['required', 'integer', 'exists:restock_request_items,id'],
            'items.*.approved_quantity' => ['required', 'integer', 'min:0'],
            'owner_notes' => ['nullable', 'string'],
        ];
    }

    public function after(): array
    {
        return [
            function (): void {
                $hasApprovedQuantity = collect($this->input('items', []))
                    ->contains(fn (array $item): bool => (int) ($item['approved_quantity'] ?? 0) > 0);

                if (! $hasApprovedQuantity) {
                    $this->validator->errors()->add('items', 'Minimal satu approved quantity harus lebih dari 0.');
                }

                // Validate items belong to this restock request
                $restockRequest = $this->route('restockRequest');
                if ($restockRequest) {
                    $validIds = $restockRequest->items()->pluck('id')->all();
                    foreach ($this->input('items', []) as $item) {
                        $itemId = (int) ($item['restock_request_item_id'] ?? 0);
                        if (! in_array($itemId, $validIds, true)) {
                            $this->validator->errors()->add('items', "Item ID {$itemId} bukan milik restock request ini.");

                            return;
                        }
                    }
                }
            },
        ];
    }
}
