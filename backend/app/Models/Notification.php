<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    public const TYPE_CONFIRMATION = 'confirmation';
    public const TYPE_REMINDER_24H = 'reminder_24h';
    public const TYPE_REMINDER_2H = 'reminder_2h';
    public const TYPE_RESCHEDULED = 'rescheduled';
    public const TYPE_CANCELLED = 'cancelled';
    public const TYPE_NO_SHOW = 'no_show';
    public const TYPE_THANK_YOU = 'thank_you';

    public const CHANNEL_EMAIL = 'email';
    public const CHANNEL_SMS = 'sms';
    public const CHANNEL_PUSH = 'push';

    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'booking_id',
        'type',
        'channel',
        'scheduled_for',
        'sent_at',
        'status',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'datetime',
            'sent_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    /**
     * The booking this notification belongs to.
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
