<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Public booking creation. Guests (no account) may book — the customer
 * details travel with the request. Signed-in customers may omit the
 * customer block and book for themselves.
 */
class StoreBookingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'service_id' => ['required', 'integer', 'exists:services,id'],
            // Null = "any available": the earliest free staff is assigned.
            'staff_id' => ['nullable', 'integer', 'exists:users,id'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start_time' => ['required', 'date_format:H:i'],
            // Customer details: required for guests, optional when signed in.
            'customer' => ['required_without:customer_id', 'array'],
            'customer.first_name' => ['required_with:customer', 'string', 'max:100'],
            'customer.last_name' => ['required_with:customer', 'string', 'max:100'],
            'customer.phone' => ['required_with:customer', 'string', 'max:32'],
            'customer.email' => ['required_with:customer', 'email', 'max:255'],
            'customer.notes' => ['nullable', 'string', 'max:2000'],
            // Signed-in customer booking for themselves via account link.
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            // "Booking for someone else": the name the appointment is under.
            'guest_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            // The cancellation policy must be explicitly accepted.
            'policy_accepted' => ['required', 'accepted'],
        ];
    }

    /**
     * Custom messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'policy_accepted.accepted' => 'You must agree to the cancellation policy to book.',
        ];
    }
}
