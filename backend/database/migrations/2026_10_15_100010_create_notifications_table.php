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
        // Notification records: what the product would send (confirmation,
        // reminders, reschedule/cancel notices). Channels are recorded, not
        // integrated — v1 logs instead of sending.
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            // confirmation | reminder_24h | reminder_2h | rescheduled |
            // cancelled | no_show | thank_you
            $table->string('type', 32);
            // email | sms | push
            $table->string('channel', 16);
            $table->dateTime('scheduled_for');
            $table->dateTime('sent_at')->nullable();
            // scheduled | sent | failed
            $table->string('status', 20)->default('scheduled');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['status', 'scheduled_for']);
            $table->index('booking_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
