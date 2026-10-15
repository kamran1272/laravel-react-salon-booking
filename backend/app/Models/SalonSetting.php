<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * Salon-wide configuration. Treated as a singleton (one row).
 */
class SalonSetting extends Model
{
    protected $fillable = [
        'salon_name',
        'timezone',
        'currency',
        'phone',
        'email',
        'address',
        'booking_window_days',
        'lead_time_minutes',
        'slot_step_minutes',
        'free_cancellation_hours',
        'cancellation_policy_text',
        'reminder_schedule',
    ];

    protected function casts(): array
    {
        return [
            'booking_window_days' => 'integer',
            'lead_time_minutes' => 'integer',
            'slot_step_minutes' => 'integer',
            'free_cancellation_hours' => 'integer',
            'reminder_schedule' => 'array',
        ];
    }

    /**
     * Fetch the singleton settings row, creating it with defaults if missing.
     */
    public static function current(): self
    {
        return static::query()->first() ?? static::create([
            'cancellation_policy_text' => 'Free cancellation up to 24 hours before your appointment. Cancellations within 24 hours or no-shows may be charged.',
            'reminder_schedule' => [
                ['offset_hours' => 24, 'channel' => 'sms'],
                ['offset_hours' => 2, 'channel' => 'sms'],
            ],
        ]);
    }

    /**
     * Current time in the salon's local timezone.
     */
    public function now(): Carbon
    {
        return Carbon::now($this->timezone);
    }

    /**
     * Convert a UTC datetime to salon-local time.
     */
    public function toSalonTime(Carbon $utc): Carbon
    {
        return $utc->copy()->setTimezone($this->timezone);
    }

    /**
     * Interpret a salon-local "Y-m-d H:i" as UTC for storage.
     */
    public function localToUtc(string $localDateTime): Carbon
    {
        return Carbon::createFromFormat('Y-m-d H:i', $localDateTime, $this->timezone)->setTimezone('UTC');
    }

    /**
     * Opening hours summary derived from staff working hours coverage.
     * Returns one entry per weekday; a day with no staff scheduled shows
     * null open/close (treated as closed for online booking).
     *
     * @return list<array{day: string, open: ?string, close: ?string}>
     */
    public function openingHours(): array
    {
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $hours = [];

        foreach ($days as $index => $day) {
            $windows = \App\Models\WorkingHour::where('day_of_week', $index)
                ->orderBy('start_time')
                ->get();

            $hours[] = [
                'day' => $day,
                'open' => $windows->isEmpty() ? null : substr((string) $windows->first()->start_time, 0, 5),
                'close' => $windows->isEmpty() ? null : substr((string) $windows->last()->end_time, 0, 5),
            ];
        }

        return $hours;
    }
}
