<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'notes',
        'no_show_count',
        'cancellation_count',
        'total_spend_cents',
        'photo_url',
        'bio',
        'bookable_online',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'no_show_count' => 'integer',
            'cancellation_count' => 'integer',
            'total_spend_cents' => 'integer',
            'bookable_online' => 'boolean',
        ];
    }

    /**
     * Determine if the user has the admin role.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Determine if the user has the staff role.
     */
    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    /**
     * Determine if the user has the customer role.
     */
    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    /**
     * Bookings this user made as a customer.
     */
    public function customerBookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'customer_id');
    }

    /**
     * Bookings assigned to this user as staff.
     */
    public function staffBookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'staff_id');
    }

    /**
     * Weekly working hours for staff users.
     */
    public function workingHours(): HasMany
    {
        return $this->hasMany(WorkingHour::class);
    }

    /**
     * Services this staff member is qualified to perform.
     */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'staff_service', 'staff_id', 'service_id')
            ->withTimestamps();
    }

    /**
     * Time-off requests for this staff member.
     */
    public function timeOffs(): HasMany
    {
        return $this->hasMany(TimeOff::class);
    }

    /**
     * One-off blocked periods for this staff member.
     */
    public function blockouts(): HasMany
    {
        return $this->hasMany(Blockout::class, 'staff_id');
    }
}
