<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Idempotent: safe to run on every deploy/restart. Existing records
     * are left untouched; only missing demo data is created.
     */
    public function run(): void
    {
        $this->call(SalonSeeder::class);
    }
}
