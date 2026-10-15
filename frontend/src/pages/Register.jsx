import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await register(form);
      navigate('/my-bookings');
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ general: err.response?.data?.message || 'Registration failed. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      errors[field]
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
        : 'border-slate-300 focus:border-rose-500 focus:ring-rose-100'
    }`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-indigo-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 text-xl font-bold text-white">
            G
          </span>
          <span className="text-xl font-bold text-slate-900">
            Glow <span className="font-light text-rose-600">&</span> Grace
          </span>
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Book faster and keep all your appointments in one place</p>

          {errors.general && (
            <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
                className={inputClass('name')} placeholder="Ayesha Khan" />
              {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name[0]}</p>}
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input id="email" name="email" type="email" required value={form.email} onChange={handleChange}
                className={inputClass('email')} placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email[0]}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange}
                className={inputClass('phone')} placeholder="+92 300 1234567" />
              {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone[0]}</p>}
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input id="password" name="password" type="password" required value={form.password} onChange={handleChange}
                className={inputClass('password')} placeholder="Minimum 8 characters" />
              {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password[0]}</p>}
            </div>
            <div>
              <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input id="password_confirmation" name="password_confirmation" type="password" required
                value={form.password_confirmation} onChange={handleChange}
                className={inputClass('password_confirmation')} placeholder="Repeat your password" />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-rose-600 hover:text-rose-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
