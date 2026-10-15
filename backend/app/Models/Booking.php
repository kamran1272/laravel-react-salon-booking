<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    /**
     * Booking lifecycle states (Fresha model).
     */
    public const STATUS_BOOKED = 'booked';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_NO_SHOW = 'no_show';

    /**
     * Statuses that occupy a time slot (block availability).
     */
    public const ACTIVE_STATUSES = [self::STATUS_BOOKED, self::STATUS_CONFIRMED];

    /**
     * Terminal states — no transitions out.
     */
    public const TERMINAL_STATUSES = [self::STATUS_COMPLETED, self::STATUS_CANCELLED, self::STATUS_NO_SHOW];

    /**
     * Allowed status transitions: current => [next, ...].
     */
    public const TRANSITIONS = [
        self::STATUS_BOOKED => [self::STATUS_CONFIRMED, self::STATUS_CANCELLED],
        self::STATUS_CONFIRMED => [self::STATUS_COMPLETED, self::STATUS_CANCELLED, self::STATUS_NO_SHOW],
        self::STATUS_COMPLETED => [],
        self::STATUS_CANCELLED => [],
        self::STATUS_NO_SHOW => [],
    ];

    /**
     * Booking sources.
     */
    public const SOURCE_ONLINE = 'online';
    public const SOURCE_WALK_IN = 'walk_in';
    public const SOURCE_PHONE = 'phone';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'reference_code',
        'customer_id',
        'staff_id',
        'service_id',
        'starts_at',
        'ends_at',
        'status',
        'source',
        'service_name',
        'duration_minutes',
        'price_cents',
        'guest_name',
        'guest_phone',
        'guest_email',
        'notes',
        'cancelled_at',
        'cancel_reason',
        'late_cancel',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'duration_minutes' => 'integer',
            'price_cents' => 'integer',
            'cancelled_at' => 'datetime',
            'late_cancel' => 'boolean',
        ];
    }

    /**
     * The customer who made the booking (null for guest/walk-in bookings).
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /**
     * The staff member assigned to the booking.
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    /**
     * The booked service.
     */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /**
     * Status change audit trail.
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(BookingStatusHistory::class)->orderBy('created_at');
    }

    /**
     * Notifications recorded for this booking.
     */
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Checkout record (created when the booking is completed).
     */
    public function sale(): HasOne
    {
        return $this->hasOne(Sale::class);
    }

    /**
     * Scope to bookings that occupy a time slot.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    /**
     * Check whether the booking may move to the given status.
     */
    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /**
     * Display name for the customer: account name, guest name, or walk-in label.
     */
    public function customerDisplayName(): string
    {
        if ($this->customer) {
            return $this->customer->name;
        }

        return $this->guest_name ?: 'Walk-in guest';
    }

    /**
     * Contact email for notifications: account email or guest email.
     */
    public function contactEmail(): ?string
    {
        return $this->customer?->email ?? $this->guest_email;
    }

    /**
     * Contact phone for notifications: account phone or guest phone.
     */
    public function contactPhone(): ?string
    {
        return $this->customer?->phone ?? $this->guest_phone;
    }
}
