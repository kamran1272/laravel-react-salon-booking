<?php

namespace Database\Factories;

use App\Models\ServiceCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Service>
 */
class ServiceFactory extends Factory
{
    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'description' => fake()->sentence(),
            'category_id' => ServiceCategory::factory(),
            'duration_minutes' => fake()->randomElement([20, 30, 45, 60, 90]),
            'buffer_minutes' => 10,
            'price_cents' => fake()->randomElement([1500, 2500, 4000, 5500, 8000]),
            'bookable_online' => true,
            'is_active' => true,
        ];
    }
}
