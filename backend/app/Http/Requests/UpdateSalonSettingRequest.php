<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSalonSettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'salon_name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:64', 'timezone'],
            'currency' => ['sometimes', 'string', 'max:8'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'booking_window_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'lead_time_minutes' => ['sometimes', 'integer', 'min:0', 'max:10080'],
            'slot_step_minutes' => ['sometimes', 'integer', 'in:5,10,15,20,30,60'],
            'free_cancellation_hours' => ['sometimes', 'integer', 'min:0', 'max:720'],
            'cancellation_policy_text' => ['nullable', 'string', 'max:5000'],
            'reminder_schedule' => ['nullable', 'array'],
            'reminder_schedule.*.offset_hours' => ['required_with:reminder_schedule', 'integer', 'min:1', 'max:720'],
            'reminder_schedule.*.channel' => ['required_with:reminder_schedule', 'string', 'in:email,sms,push'],
        ];
    }
}
