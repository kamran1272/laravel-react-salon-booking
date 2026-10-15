import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute, { AdminRoute, RoleRoute } from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import Home from './pages/Home.jsx';
import ServiceDetail from './pages/ServiceDetail.jsx';
import BookFlow from './pages/BookFlow.jsx';
import Confirmation from './pages/Confirmation.jsx';
import ManageBooking from './pages/ManageBooking.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Schedule from './pages/Schedule.jsx';
import MyShifts from './pages/MyShifts.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminServices from './pages/AdminServices.jsx';
import AdminStaff from './pages/AdminStaff.jsx';
import AdminBookings from './pages/AdminBookings.jsx';
import AdminCustomers from './pages/AdminCustomers.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import AdminNotifications from './pages/AdminNotifications.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  // Works both at domain root and under a sub-path (e.g. GitHub Pages):
  // Vite's BASE_URL (from the `base` build option) becomes the router basename.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          {/* Standalone auth pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public salon site */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            <Route path="/book/:serviceId" element={<BookFlow />} />
            <Route path="/confirmation/:reference" element={<Confirmation />} />
            <Route path="/manage" element={<ManageBooking />} />
          </Route>

          {/* Authenticated app shell */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Any signed-in user */}
            <Route path="/my-bookings" element={<MyBookings />} />

            {/* Staff + admin */}
            <Route
              path="/staff/schedule"
              element={
                <RoleRoute roles={['staff', 'admin']}>
                  <Schedule />
                </RoleRoute>
              }
            />
            <Route
              path="/staff/shifts"
              element={
                <RoleRoute roles={['staff', 'admin']}>
                  <MyShifts />
                </RoleRoute>
              }
            />

            {/* Admin only */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <AdminRoute>
                  <AdminServices />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <AdminRoute>
                  <AdminStaff />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/bookings"
              element={
                <AdminRoute>
                  <AdminBookings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <AdminRoute>
                  <AdminCustomers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <AdminSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <AdminRoute>
                  <AdminNotifications />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
