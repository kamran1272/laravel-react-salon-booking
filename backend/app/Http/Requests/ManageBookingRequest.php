<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Guest "manage my booking" access: reference code + the email the booking
 * was made with. No account required.
 */
class ManageBookingRequest extends FormRequest
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
            'reference_code' => ['required', 'string', 'max:16'],
            'email' => ['required', 'email', 'max:255'],
        ];
    }
}
