<?php

namespace App\Http\Requests\Owner;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

class SaveCustomerBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'alt_text' => ['required', 'string', 'max:500'],
            'image' => [
                $this->route('banner') ? 'nullable' : 'required',
                'image', 'mimes:jpg,jpeg,png,webp', 'max:5120',
                'dimensions:min_width=600,min_height=240,max_width=4000,max_height=4000,ratio=5/2',
            ],
            'target_path' => ['bail', 'nullable', 'string', 'max:2048', function (string $attribute, mixed $value, Closure $fail): void {
                // Check every decoding layer so nested escapes cannot hide a redirect or traversal.
                $path = $value;
                do {
                    if (! preg_match('~^/customer(?:/|[?#]|$)~', $path)
                        || preg_match('/[\\\\\x00-\x20\x7f]/', $path)
                        || preg_match('~(?:^|/)\.{1,2}(?:/|[?#]|$)~', $path)
                        || str_contains(explode('?', explode('#', $path, 2)[0], 2)[0], '//')) {
                        $fail('Tujuan harus berupa path customer internal yang aman.');

                        return;
                    }
                    $decoded = rawurldecode($path);
                    $unchanged = $decoded === $path;
                    $path = $decoded;
                } while (! $unchanged);
            }],
            'sort_order' => ['required', 'integer', 'between:0,9999'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
