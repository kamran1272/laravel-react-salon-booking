<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('salon_settings', function (Blueprint $table) {
            $table->id();
            $table->string('salon_name')->default('Glow & Grace Salon');
            $table->string('timezone', 64)->default('Asia/Karachi');
            $table->string('currency', 8)->default('PKR');
            $table->string('phone', 32)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('address', 500)->nullable();
            // Scheduling policy.
            $table->unsignedInteger('booking_window_days')->default(42);
            $table->unsignedInteger('lead_time_minutes')->default(120);
            $table->unsignedInteger('slot_step_minutes')->default(15);
            $table->unsignedInteger('free_cancellation_hours')->default(24);
            $table->text('cancellation_policy_text')->nullable();
            // Reminder schedule: JSON array of {offset_hours, channel}.
            $table->json('reminder_schedule')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('salon_settings');
    }
};
