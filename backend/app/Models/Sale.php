<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sale extends Model
{
    protected $fillable = [
        'booking_id',
        'staff_id',
        'total_cents',
        'payment_method',
    ];

    protected function casts(): array
    {
        return ['total_cents' => 'integer'];
    }

    /**
     * The booking this sale settles.
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * The staff member who checked out the booking.
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
