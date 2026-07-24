<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
use App\Http\Requests\Owner\RejectRefundRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class RejectRefundRequestTest extends TestCase
{
    use RefreshDatabase;

    private function rules(): array
    {
        return (new RejectRefundRequest())->rules();
    }

    private function assertValidation(array $data, bool $shouldPass): void
    {
        $validator = Validator::make($data, $this->rules());
        $this->assertSame($shouldPass, $validator->passes());
    }

    public function test_reason_is_required(): void
    {
        $this->assertValidation(['reason' => null], false);
    }

    public function test_reason_must_be_valid_enum_value(): void
    {
        $this->assertValidation(['reason' => 'not_a_valid_reason'], false);
    }

    public function test_reason_accepts_valid_enum_value(): void
    {
        foreach (RefundRejectionReason::cases() as $case) {
            $this->assertValidation(['reason' => $case->value], true);
        }
    }

    public function test_note_is_optional(): void
    {
        $this->assertValidation(['reason' => RefundRejectionReason::Other->value], true);
    }

    public function test_note_max_500_chars(): void
    {
        $this->assertValidation([
            'reason' => RefundRejectionReason::Other->value,
            'note' => str_repeat('a', 501),
        ], false);
    }

    public function test_note_accepts_valid_value(): void
    {
        $this->assertValidation([
            'reason' => RefundRejectionReason::Other->value,
            'note' => 'Pelanggan sudah dihubungi via WhatsApp.',
        ], true);
    }

    public function test_non_owner_authorize_returns_false(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $request = new RejectRefundRequest();
        $request->setUserResolver(fn () => $user);

        $this->assertFalse($request->authorize());
    }

    public function test_owner_authorize_returns_true(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $request = new RejectRefundRequest();
        $request->setUserResolver(fn () => $owner);

        $this->assertTrue($request->authorize());
    }

    public function test_valid_combination_passes(): void
    {
        $this->assertValidation([
            'reason' => RefundRejectionReason::InvalidDestination->value,
            'note' => 'Data rekening tidak sesuai dengan nama customer.',
        ], true);
    }
}
