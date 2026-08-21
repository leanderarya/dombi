<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->string('nominee_vehicle_plate')->nullable()->after('nominee_phone');
            $table->string('nominee_face_photo')->nullable()->after('nominee_vehicle_plate');
            $table->string('nominee_vehicle_photo')->nullable()->after('nominee_face_photo');
            $table->string('rejection_reason')->nullable()->after('accepted_at');
            $table->timestamp('resubmitted_at')->nullable()->after('rejection_reason');
        });

        DB::statement("ALTER TABLE courier_profiles MODIFY invitation_status ENUM('pending','accepted','rejected','submitted','approved_pending_activation','active') NOT NULL DEFAULT 'pending'");

        DB::statement("UPDATE courier_profiles SET invitation_status = 'submitted' WHERE invitation_status = 'pending' AND approved_at IS NULL");
        DB::statement("UPDATE courier_profiles SET invitation_status = 'approved_pending_activation' WHERE invitation_status = 'pending' AND approved_at IS NOT NULL");
        DB::statement("UPDATE courier_profiles SET invitation_status = 'active' WHERE invitation_status = 'accepted'");

        Schema::create('courier_nomination_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courier_profile_id')->constrained('courier_profiles')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users');
            $table->enum('decision', ['approved', 'rejected']);
            $table->string('reason')->nullable();
            $table->timestamp('decided_at');
            $table->timestamps();

            $table->index(['courier_profile_id', 'decided_at']);
        });
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE courier_profiles MODIFY invitation_status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending'");

        DB::statement("UPDATE courier_profiles SET invitation_status = 'pending' WHERE invitation_status IN ('submitted', 'approved_pending_activation')");
        DB::statement("UPDATE courier_profiles SET invitation_status = 'accepted' WHERE invitation_status = 'active'");

        Schema::dropIfExists('courier_nomination_reviews');

        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->dropColumn(['nominee_vehicle_plate', 'nominee_face_photo', 'nominee_vehicle_photo', 'rejection_reason', 'resubmitted_at']);
        });
    }
};
