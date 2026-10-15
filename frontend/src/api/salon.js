/**
 * Thin salon API layer — every call maps 1:1 to an endpoint in API-CONTRACT.md.
 * Components must not build URLs or reshape payloads; they call these
 * functions and consume the contract's response shapes directly.
 */
import client from './client.js';

/* ---------------- Public ---------------- */

export const getSalon = () => client.get('/salon').then((r) => r.data);

export const getServices = () => client.get('/services').then((r) => r.data);

export const getService = (id) => client.get(`/services/${id}`).then((r) => r.data);

export const getStaff = (serviceId) =>
  client.get('/staff', { params: serviceId ? { service_id: serviceId } : {} }).then((r) => r.data);

export const getAvailability = (serviceId, staffId, date) =>
  client
    .get('/availability', { params: { service_id: serviceId, staff_id: staffId || undefined, date } })
    .then((r) => r.data);

export const getAvailabilityCalendar = (serviceId, staffId, from, to) =>
  client
    .get('/availability/calendar', {
      params: { service_id: serviceId, staff_id: staffId || undefined, from, to },
    })
    .then((r) => r.data);

export const createBooking = (payload) => client.post('/bookings', payload).then((r) => r.data);

export const lookupManagedBooking = (referenceCode, email) =>
  client.post('/bookings/manage/lookup', { reference_code: referenceCode, email }).then((r) => r.data);

export const cancelManagedBooking = (referenceCode, email) =>
  client.post(`/bookings/manage/${referenceCode}/cancel`, { email }).then((r) => r.data);

export const rescheduleManagedBooking = (referenceCode, email, date, startTime) =>
  client
    .post(`/bookings/manage/${referenceCode}/reschedule`, { email, date, start_time: startTime })
    .then((r) => r.data);

/* ---------------- Customer (auth) ---------------- */

export const getMyBookings = () => client.get('/bookings').then((r) => r.data);

export const getBooking = (id) => client.get(`/bookings/${id}`).then((r) => r.data);

export const cancelMyBooking = (id) => client.post(`/bookings/${id}/cancel`).then((r) => r.data);

export const rescheduleMyBooking = (id, date, startTime, staffId) =>
  client
    .post(`/bookings/${id}/reschedule`, { date, start_time: startTime, staff_id: staffId || undefined })
    .then((r) => r.data);

/* ---------------- Staff (auth + role staff/admin) ---------------- */

export const getSchedule = ({ date, view = 'day', staffId } = {}) =>
  client
    .get('/staff/schedule', { params: { date, view, staff_id: staffId || undefined } })
    .then((r) => r.data);

export const getShifts = () => client.get('/staff/shifts').then((r) => r.data);

export const requestTimeOff = (payload) => client.post('/staff/time-off', payload).then((r) => r.data);

export const confirmBooking = (id) => client.post(`/bookings/${id}/confirm`).then((r) => r.data);
export const completeBooking = (id) => client.post(`/bookings/${id}/complete`).then((r) => r.data);
export const markNoShow = (id) => client.post(`/bookings/${id}/no-show`).then((r) => r.data);
export const cancelBookingAsStaff = (id) => client.post(`/bookings/${id}/cancel`).then((r) => r.data);

export const walkInBooking = (payload) => client.post('/staff/walk-in', payload).then((r) => r.data);

/* ---------------- Admin (auth + role admin) ---------------- */

export const getDashboard = () => client.get('/admin/dashboard').then((r) => r.data);

export const getAdminServices = () => client.get('/admin/services').then((r) => r.data);
export const createService = (payload) => client.post('/admin/services', payload).then((r) => r.data);
export const updateService = (id, payload) => client.put(`/admin/services/${id}`, payload).then((r) => r.data);
export const deleteService = (id) => client.delete(`/admin/services/${id}`).then((r) => r.data);

export const getCategories = () => client.get('/admin/service-categories').then((r) => r.data);
export const createCategory = (payload) => client.post('/admin/service-categories', payload).then((r) => r.data);
export const updateCategory = (id, payload) =>
  client.put(`/admin/service-categories/${id}`, payload).then((r) => r.data);
export const deleteCategory = (id) => client.delete(`/admin/service-categories/${id}`).then((r) => r.data);

export const getAdminStaff = () => client.get('/admin/staff').then((r) => r.data);
export const createStaffMember = (payload) => client.post('/admin/staff', payload).then((r) => r.data);
export const updateStaffMember = (id, payload) =>
  client.put(`/admin/staff/${id}`, payload).then((r) => r.data);

export const getWorkingHours = (staffId) =>
  client.get('/admin/working-hours', { params: { staff_id: staffId } }).then((r) => r.data);
export const createWorkingHours = (payload) =>
  client.post('/admin/working-hours', payload).then((r) => r.data);
export const deleteWorkingHours = (id) =>
  client.delete(`/admin/working-hours/${id}`).then((r) => r.data);

export const getTimeOff = (status) =>
  client.get('/admin/time-off', { params: status ? { status } : {} }).then((r) => r.data);
export const approveTimeOff = (id) => client.post(`/admin/time-off/${id}/approve`).then((r) => r.data);
export const declineTimeOff = (id) => client.post(`/admin/time-off/${id}/decline`).then((r) => r.data);

export const getBlockouts = () => client.get('/admin/blockouts').then((r) => r.data);
export const createBlockout = (payload) => client.post('/admin/blockouts', payload).then((r) => r.data);
export const deleteBlockout = (id) => client.delete(`/admin/blockouts/${id}`).then((r) => r.data);

export const getAdminBookings = (filters = {}) =>
  client.get('/admin/bookings', { params: filters }).then((r) => r.data);
export const createAdminBooking = (payload) =>
  client.post('/admin/bookings', payload).then((r) => r.data);
export const updateAdminBooking = (id, payload) =>
  client.put(`/admin/bookings/${id}`, payload).then((r) => r.data);

export const getCustomers = (search) =>
  client.get('/admin/customers', { params: search ? { search } : {} }).then((r) => r.data);
export const getCustomer = (id) => client.get(`/admin/customers/${id}`).then((r) => r.data);
/** NOTE: not in API-CONTRACT.md v1 — the demo mock honours it; the backend
 *  team needs to add PUT /api/admin/customers/{id} for this to work live. */
export const updateCustomerNotes = (id, notes) =>
  client.put(`/admin/customers/${id}`, { notes }).then((r) => r.data);

export const getSettings = () => client.get('/admin/settings').then((r) => r.data);
export const updateSettings = (payload) => client.put('/admin/settings', payload).then((r) => r.data);

export const getNotifications = (filters = {}) =>
  client.get('/admin/notifications', { params: filters }).then((r) => r.data);
