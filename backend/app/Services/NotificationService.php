<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Notification;
use App\Models\SalonSetting;
use Illuminate\Support\Facades\Log;

/**
 * Records notifications the product would send (booking confirmation,
 * reminders, reschedule/cancel notices). v1 does not integrate with any
 * SMS/email provider — every notification is stored as a record and written
 * to the application log, so the salon has a complete audit trail and the
 * product is honest about what it promises.
 */
class NotificationService
{
    /**
     * The salon's scheduling policy (singleton, resolved lazily).
     */
    protected function settings(): SalonSetting
    {
        return SalonSetting::current();
    }

    /**
     * Booking confirmation: sent immediately on booking (email + sms).
     * Also schedules the salon's configured reminders.
     */
    public function recordConfirmation(Booking $booking): void
    {
        $this->record($booking, Notification::TYPE_CONFIRMATION, Notification::CHANNEL_EMAIL, now());
        $this->record($booking, Notification::TYPE_CONFIRMATION, Notification::CHANNEL_SMS, now());
        $this->scheduleReminders($booking);
    }

    /**
     * Schedule reminders from the salon's reminder schedule
     * (default: 24h and 2h before, via SMS).
     */
    public function scheduleReminders(Booking $booking): void
    {
        $schedule = $this->settings()->reminder_schedule ?? [
            ['offset_hours' => 24, 'channel' => 'sms'],
            ['offset_hours' => 2, 'channel' => 'sms'],
        ];

        foreach ($schedule as $reminder) {
            $type = 'reminder_'.$reminder['offset_hours'].'h';
            $sendAt = $booking->starts_at->copy()->subHours($reminder['offset_hours']);

            // Don't schedule reminders in the past.
            if ($sendAt->lte(now())) {
                continue;
            }

            $this->record(
                $booking,
                $type,
                $reminder['channel'],
                $sendAt,
                markSent: false
            );
        }
    }

    /**
     * Reschedule confirmation (email + sms), sent immediately.
     */
    public function recordRescheduled(Booking $booking): void
    {
        $this->cancelPendingReminders($booking);
        $this->record($booking, Notification::TYPE_RESCHEDULED, Notification::CHANNEL_EMAIL, now());
        $this->record($booking, Notification::TYPE_RESCHEDULED, Notification::CHANNEL_SMS, now());
        $this->scheduleReminders($booking);
    }

    /**
     * Cancellation confirmation (email + sms), sent immediately.
     */
    public function recordCancelled(Booking $booking): void
    {
        $this->cancelPendingReminders($booking);
        $this->record($booking, Notification::TYPE_CANCELLED, Notification::CHANNEL_EMAIL, now());
        $this->record($booking, Notification::TYPE_CANCELLED, Notification::CHANNEL_SMS, now());
    }

    /**
     * No-show notice (sms), sent immediately.
     */
    public function recordNoShow(Booking $booking): void
    {
        $this->cancelPendingReminders($booking);
        $this->record($booking, Notification::TYPE_NO_SHOW, Notification::CHANNEL_SMS, now());
    }

    /**
     * Thank-you + review request after checkout (sms), sent immediately.
     */
    public function recordThankYou(Booking $booking): void
    {
        $this->record($booking, Notification::TYPE_THANK_YOU, Notification::CHANNEL_SMS, now());
    }

    /**
     * Mark due scheduled notifications as sent (called by the
     * notifications:dispatch artisan command). In v1 "sending" means:
     * the record is marked sent and the message is written to the log.
     */
    public function dispatchDue(): int
    {
        $due = Notification::where('status', Notification::STATUS_SCHEDULED)
            ->where('scheduled_for', '<=', now())
            ->with('booking')
            ->get();

        foreach ($due as $notification) {
            $this->markSent($notification);
        }

        return $due->count();
    }

    /**
     * Record a notification: persist the row and write the log entry.
     */
    protected function record(
        Booking $booking,
        string $type,
        string $channel,
        \DateTimeInterface $scheduledFor,
        bool $markSent = true
    ): Notification {
        $notification = Notification::create([
            'booking_id' => $booking->id,
            'type' => $type,
            'channel' => $channel,
            'scheduled_for' => $scheduledFor,
            'sent_at' => $markSent ? now() : null,
            'status' => $markSent ? Notification::STATUS_SENT : Notification::STATUS_SCHEDULED,
            'payload' => $this->payloadFor($booking, $type),
        ]);

        if ($markSent) {
            $this->writeLog($notification);
        }

        return $notification;
    }

    /**
     * Mark a scheduled notification sent and log it.
     */
    protected function markSent(Notification $notification): void
    {
        $notification->update([
            'status' => Notification::STATUS_SENT,
            'sent_at' => now(),
        ]);

        $this->writeLog($notification);
    }

    /**
     * Drop pending reminders (e.g. after a reschedule or cancellation the
     * old reminder times no longer apply).
     */
    protected function cancelPendingReminders(Booking $booking): void
    {
        Notification::where('booking_id', $booking->id)
            ->where('status', Notification::STATUS_SCHEDULED)
            ->where('type', 'like', 'reminder_%')
            ->delete();
    }

    /**
     * Message content that would be sent, stored for the audit trail.
     */
    protected function payloadFor(Booking $booking, string $type): array
    {
        $local = $booking->starts_at->copy()->setTimezone($this->settings()->timezone);

        $payload = [
            'to_email' => $booking->contactEmail(),
            'to_phone' => $booking->contactPhone(),
            'reference_code' => $booking->reference_code,
            'service' => $booking->service_name,
            'staff' => $booking->staff?->name,
            'starts_at' => $local->format('l, F j \\a\\t g:i A'),
            'timezone' => $this->settings()->timezone,
        ];

        $payload['body'] = match ($type) {
            Notification::TYPE_CONFIRMATION => "Your appointment is booked: {$payload['service']} with {$payload['staff']} on {$payload['starts_at']}. Reference {$payload['reference_code']}.",
            Notification::TYPE_RESCHEDULED => "Your appointment has been moved to {$payload['starts_at']}. Reference {$payload['reference_code']}.",
            Notification::TYPE_CANCELLED => "Your appointment on {$payload['starts_at']} has been cancelled. Reference {$payload['reference_code']}.",
            Notification::TYPE_NO_SHOW => "We missed you at your appointment on {$payload['starts_at']}. Please contact the salon to rebook. Reference {$payload['reference_code']}.",
            Notification::TYPE_THANK_YOU => "Thank you for visiting! We'd love your feedback on your {$payload['service']} appointment.",
            default => "Reminder: you have {$payload['service']} with {$payload['staff']} on {$payload['starts_at']}. Reference {$payload['reference_code']}.",
        };

        return $payload;
    }

    /**
     * The v1 "send": a structured log entry. A real provider integration
     * would replace this method without touching anything else.
     */
    protected function writeLog(Notification $notification): void
    {
        $payload = $notification->payload ?? [];

        Log::info('[notification] '.$notification->type.' via '.$notification->channel, [
            'notification_id' => $notification->id,
            'booking_id' => $notification->booking_id,
            'to_email' => $payload['to_email'] ?? null,
            'to_phone' => $payload['to_phone'] ?? null,
            'body' => $payload['body'] ?? null,
        ]);
    }
}
