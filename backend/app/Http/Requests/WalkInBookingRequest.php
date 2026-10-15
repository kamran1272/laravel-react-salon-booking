<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Staff-created booking: walk-ins and phone bookings go into the same
 * calendar as online bookings, with the same overlap protection.
 */
class WalkInBookingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && ($user->isAdmin() || $user->isStaff());
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
            'staff_id' => ['required', 'integer', 'exists:users,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            // Attach an existing customer, or create the booking with
            // guest details (name + phone minimum).
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['required_without:customer_id', 'string', 'max:255'],
            'customer_phone' => ['required_without:customer_id', 'string', 'max:32'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'source' => ['sometimes', 'string', 'in:walk_in,phone'],
        ];
    }
}
