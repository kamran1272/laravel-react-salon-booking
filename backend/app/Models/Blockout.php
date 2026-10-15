<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Blockout extends Model
{
    protected $fillable = [
        'staff_id',
        'starts_at',
        'ends_at',
        'reason',
        'blocks_online_booking',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'blocks_online_booking' => 'boolean',
        ];
    }

    /**
     * The staff member blocked (null = whole salon).
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
