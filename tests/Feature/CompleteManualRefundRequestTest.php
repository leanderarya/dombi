<?php

namespace Tests\Feature;

use App\Http\Requests\Owner\CompleteManualRefundRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class CompleteManualRefundRequestTest extends TestCase
{
    use RefreshDatabase;

    private function rules(): array
    {
        return (new CompleteManualRefundRequest())->rules();
    }

    private function assertValidation(array $data, bool $shouldPass): void
    {
        $validator = Validator::make($data, $this->rules());
        $this->assertSame($shouldPass, $validator->passes());
    }

    public function test_proof_is_required(): void
    {
        $this->assertValidation(['proof' => null], false);
    }

    public function test_proof_must_be_an_image(): void
    {
        $file = UploadedFile::fake()->create('doc.pdf', 100);
        $this->assertValidation(['proof' => $file], false);
    }

    public function test_proof_max_2048kb(): void
    {
        $file = UploadedFile::fake()->image('large.jpg')->size(3000);
        $this->assertValidation(['proof' => $file], false);
    }

    public function test_transfer_reference_is_optional(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
        ], true);
    }

    public function test_transfer_reference_max_255_chars(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
            'transfer_reference' => str_repeat('a', 256),
        ], false);
    }

    public function test_transfer_reference_accepts_valid_value(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
            'transfer_reference' => 'TRF-001',
        ], true);
    }

    public function test_transfer_note_is_optional(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
        ], true);
    }

    public function test_transfer_note_max_500_chars(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
            'transfer_note' => str_repeat('a', 501),
        ], false);
    }

    public function test_transfer_note_accepts_valid_value(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
            'transfer_note' => 'Transfer via BCA',
        ], true);
    }

    public function test_non_owner_authorize_returns_false(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $request = new CompleteManualRefundRequest();
        $request->setUserResolver(fn () => $user);

        $this->assertFalse($request->authorize());
    }

    public function test_owner_authorize_returns_true(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $request = new CompleteManualRefundRequest();
        $request->setUserResolver(fn () => $owner);

        $this->assertTrue($request->authorize());
    }

    public function test_valid_image_passes_validation(): void
    {
        $this->assertValidation([
            'proof' => UploadedFile::fake()->image('proof.jpg'),
            'transfer_reference' => 'TRF-001',
            'transfer_note' => 'Test transfer',
        ], true);
    }
}
