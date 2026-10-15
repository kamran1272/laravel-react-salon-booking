<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:service_categories,id'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'buffer_minutes' => ['sometimes', 'integer', 'min:0', 'max:120'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'bookable_online' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'staff_ids' => ['nullable', 'array'],
            'staff_ids.*' => ['integer', 'exists:users,id'],
        ];
    }
}
