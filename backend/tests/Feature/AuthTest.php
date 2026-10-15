<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_returns_token_and_user(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email', 'phone', 'role', 'email_verified_at', 'created_at', 'updated_at'],
                'token',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'customer@example.com',
            'role' => 'customer',
        ]);
    }

    public function test_register_cannot_self_assign_staff_role(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Sneaky User',
            'email' => 'sneaky@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'staff',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'sneaky@example.com',
            'role' => 'customer',
        ]);
    }

    public function test_login_returns_token_and_user(): void
    {
        User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role'], 'token']);
    }

    public function test_login_with_wrong_password_returns_401(): void
    {
        User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'wrongpassword',
        ]);

        // Same flat 401 whether the email or the password is wrong —
        // the endpoint never reveals which half failed.
        $response->assertStatus(401)
            ->assertJson(['message' => 'Invalid credentials']);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_me_without_accept_header_returns_json_401(): void
    {
        $response = $this->call('GET', '/api/auth/me', [], [], [], ['HTTP_ACCEPT' => 'text/html']);

        $response->assertStatus(401);
        $this->assertEquals('application/json', $response->headers->get('Content-Type'));
    }

    public function test_customer_cannot_hit_admin_endpoints(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $this->actingAs($customer)->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->actingAs($customer)->getJson('/api/admin/bookings')->assertStatus(403);
        $this->actingAs($customer)->getJson('/api/admin/working-hours')->assertStatus(403);
    }

    public function test_staff_cannot_hit_admin_endpoints(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);

        $this->actingAs($staff)->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->actingAs($staff)->postJson('/api/admin/services', [])->assertStatus(403);
    }
}
