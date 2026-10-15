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
        Schema::table('users', function (Blueprint $table) {
            // Customer profile fields.
            $table->text('notes')->nullable()->after('phone');
            $table->unsignedInteger('no_show_count')->default(0)->after('notes');
            $table->unsignedInteger('cancellation_count')->default(0)->after('no_show_count');
            $table->unsignedBigInteger('total_spend_cents')->default(0)->after('cancellation_count');
            // Staff profile fields.
            $table->string('photo_url', 500)->nullable()->after('total_spend_cents');
            $table->text('bio')->nullable()->after('photo_url');
            $table->boolean('bookable_online')->default(true)->after('bio');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'notes',
                'no_show_count',
                'cancellation_count',
                'total_spend_cents',
                'photo_url',
                'bio',
                'bookable_online',
            ]);
        });
    }
};
