<?php

use App\Http\Controllers\Api\AdminBookingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AvailabilityController;
use App\Http\Controllers\Api\BlockoutController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BookingStatusController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ManageBookingController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SalonSettingController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StaffScheduleController;
use App\Http\Controllers\Api\TimeOffController;
use App\Http\Controllers\Api\WorkingHourController;
use Illuminate\Support\Facades\Route;

// Public auth endpoints
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

// Public salon profile, catalog, availability, booking
Route::get('salon', [SalonSettingController::class, 'public']);
Route::get('services', [ServiceController::class, 'index']);
Route::get('services/{service}', [ServiceController::class, 'show']);
Route::get('staff', [StaffController::class, 'index']);
Route::get('availability', [AvailabilityController::class, 'index']);
Route::get('availability/calendar', [AvailabilityController::class, 'calendar']);
Route::post('bookings', [BookingController::class, 'store']);

// Guest "manage my booking" (reference code + email, no account needed)
Route::post('bookings/manage/lookup', [ManageBookingController::class, 'lookup']);
Route::post('bookings/manage/{reference}/cancel', [ManageBookingController::class, 'cancel']);
Route::post('bookings/manage/{reference}/reschedule', [ManageBookingController::class, 'reschedule']);

// Authenticated customer endpoints
Route::middleware('auth:sanctum')->group(function () {
    Route::get('bookings', [BookingController::class, 'index']);
    Route::get('bookings/{booking}', [BookingController::class, 'show']);
    Route::post('bookings/{booking}/cancel', [BookingController::class, 'cancel']);
    Route::post('bookings/{booking}/reschedule', [BookingController::class, 'reschedule']);
});

// Staff + admin endpoints
Route::middleware(['auth:sanctum', 'role:staff,admin'])->group(function () {
    Route::get('staff/schedule', [StaffScheduleController::class, 'index']);
    Route::get('staff/shifts', [StaffScheduleController::class, 'shifts']);
    Route::post('staff/time-off', [StaffScheduleController::class, 'requestTimeOff']);
    Route::post('staff/walk-in', [StaffScheduleController::class, 'walkIn']);

    Route::post('bookings/{booking}/confirm', [BookingStatusController::class, 'confirm']);
    Route::post('bookings/{booking}/complete', [BookingStatusController::class, 'complete']);
    Route::post('bookings/{booking}/no-show', [BookingStatusController::class, 'noShow']);
    Route::post('bookings/{booking}/cancel', [BookingStatusController::class, 'cancel']);
});

// Admin-only endpoints
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('admin/dashboard', [DashboardController::class, 'stats']);

    Route::get('admin/services', [ServiceController::class, 'adminIndex']);
    Route::post('admin/services', [ServiceController::class, 'store']);
    Route::put('admin/services/{service}', [ServiceController::class, 'update']);
    Route::delete('admin/services/{service}', [ServiceController::class, 'destroy']);

    Route::get('admin/service-categories', [ServiceCategoryController::class, 'index']);
    Route::post('admin/service-categories', [ServiceCategoryController::class, 'store']);
    Route::put('admin/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'update']);
    Route::delete('admin/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'destroy']);

    Route::get('admin/staff', [StaffController::class, 'adminIndex']);
    Route::post('admin/staff', [StaffController::class, 'store']);
    Route::put('admin/staff/{staff}', [StaffController::class, 'update']);

    Route::get('admin/working-hours', [WorkingHourController::class, 'index']);
    Route::post('admin/working-hours', [WorkingHourController::class, 'store']);
    Route::delete('admin/working-hours/{workingHour}', [WorkingHourController::class, 'destroy']);
    Route::get('admin/working-hours/staff/{user}', [WorkingHourController::class, 'forStaff']);

    Route::get('admin/time-off', [TimeOffController::class, 'index']);
    Route::post('admin/time-off/{timeOff}/approve', [TimeOffController::class, 'approve']);
    Route::post('admin/time-off/{timeOff}/decline', [TimeOffController::class, 'decline']);

    Route::get('admin/blockouts', [BlockoutController::class, 'index']);
    Route::post('admin/blockouts', [BlockoutController::class, 'store']);
    Route::delete('admin/blockouts/{blockout}', [BlockoutController::class, 'destroy']);

    Route::get('admin/bookings', [AdminBookingController::class, 'index']);
    Route::post('admin/bookings', [AdminBookingController::class, 'store']);
    Route::put('admin/bookings/{booking}', [AdminBookingController::class, 'update']);

    Route::get('admin/customers', [CustomerController::class, 'index']);
    Route::get('admin/customers/{customer}', [CustomerController::class, 'show']);
    Route::put('admin/customers/{customer}/notes', [CustomerController::class, 'updateNotes']);
    // Alias: frontend's updateCustomerNotes() targets this path.
    Route::put('admin/customers/{customer}', [CustomerController::class, 'updateNotes']);

    Route::get('admin/settings', [SalonSettingController::class, 'show']);
    Route::put('admin/settings', [SalonSettingController::class, 'update']);

    Route::get('admin/notifications', [NotificationController::class, 'index']);
    Route::get('admin/notifications/{notification}', [NotificationController::class, 'show']);
});
