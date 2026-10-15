<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Mark due scheduled notifications (e.g. 24h / 2h reminders) as sent.
 * In v1 "sending" writes a structured log entry — wire a real provider
 * into NotificationService::writeLog() when ready.
 *
 * Recommended schedule: every 15 minutes.
 */
class DispatchNotifications extends Command
{
    protected $signature = 'notifications:dispatch';

    protected $description = 'Dispatch due scheduled notifications (reminders etc.)';

    public function handle(NotificationService $notifications): int
    {
        $count = $notifications->dispatchDue();

        $this->info("Dispatched {$count} notification(s).");

        return self::SUCCESS;
    }
}
