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
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            // Customer-facing reference, e.g. BK-8F3K2Q.
            $table->string('reference_code', 16)->unique();
            // Nullable: walk-ins and guest bookings may not have an account.
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('staff_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();
            // Stored in UTC; rendered in the salon timezone.
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            // booked -> confirmed -> completed | cancelled | no_show
            $table->string('status', 20)->default('booked');
            // online | walk_in | phone
            $table->string('source', 20)->default('online');
            // Snapshots: what the customer agreed to at booking time.
            $table->string('service_name', 255);
            $table->unsignedInteger('duration_minutes');
            $table->unsignedBigInteger('price_cents');
            // Guest / "booking for someone else" details.
            $table->string('guest_name', 255)->nullable();
            $table->string('guest_phone', 32)->nullable();
            $table->string('guest_email', 255)->nullable();
            $table->text('notes')->nullable();
            // Cancellation bookkeeping.
            $table->dateTime('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->boolean('late_cancel')->default(false);
            $table->timestamps();

            $table->index(['staff_id', 'starts_at']);
            $table->index(['customer_id', 'starts_at']);
            $table->index(['status', 'starts_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
