<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingStatusHistory extends Model
{
    public const BY_USER = 'user';
    public const BY_CUSTOMER = 'customer';
    public const BY_SYSTEM = 'system';

    protected $fillable = [
        'booking_id',
        'from_status',
        'to_status',
        'changed_by',
        'changed_by_type',
        'note',
    ];

    /**
     * The booking this history entry belongs to.
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * The user who made the change (null for customer/system changes).
     */
    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
