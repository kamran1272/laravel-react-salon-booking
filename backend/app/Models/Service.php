<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    use HasFactory;
    protected $fillable = [
        'category_id',
        'name',
        'description',
        'duration_minutes',
        'buffer_minutes',
        'price_cents',
        'bookable_online',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'price_cents' => 'integer',
            'bookable_online' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Category this service belongs to.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }

    /**
     * Staff members qualified to perform this service.
     */
    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'staff_service', 'service_id', 'staff_id')
            ->withTimestamps();
    }

    /**
     * Bookings made for this service.
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * Human price for display, e.g. "PKR 2,500.00".
     */
    public function priceDisplay(string $currency = ''): string
    {
        $amount = number_format($this->price_cents / 100, 2);

        return trim($currency.' '.$amount) ?: $amount;
    }
}
