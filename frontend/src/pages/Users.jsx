import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import UsersTable from '../components/UsersTable.jsx';

const emptyForm = { name: '', email: '', password: '', role: 'user' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/users', { params: { page } });
      setUsers(res.data.data ?? []);
      setMeta(res.data.meta ?? { current_page: page, last_page: page });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setModal('add');
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setFormErrors({});
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setSaving(true);
    try {
      if (modal === 'add') {
        await client.post('/users', form);
      } else {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await client.put(`/users/${editing.id}`, payload);
      }
      closeModal();
      fetchUsers(meta.current_page);
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.errors) {
        setFormErrors(err.response.data.errors);
      } else {
        setFormErrors({ general: err.response?.data?.message || 'Save failed. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await client.delete(`/users/${u.id}`);
      fetchUsers(meta.current_page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const inputClass = (field) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      formErrors[field]
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Users</h2>
        <button
          onClick={openAdd}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Add User
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-6 py-4 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : users.length > 0 ? (
        <UsersTable users={users} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">No users found.</div>
      )}

      {/* Pagination */}
      {!loading && meta.last_page > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => fetchUsers(meta.current_page - 1)}
            disabled={meta.current_page <= 1}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <button
            onClick={() => fetchUsers(meta.current_page + 1)}
            disabled={meta.current_page >= meta.last_page}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {modal === 'add' ? 'Add User' : 'Edit User'}
            </h3>

            {formErrors.general && (
              <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass('name')}
                />
                {formErrors.name && <p className="mt-1 text-xs text-rose-600">{formErrors.name[0]}</p>}
              </div>
              <div>
                <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass('email')}
                />
                {formErrors.email && <p className="mt-1 text-xs text-rose-600">{formErrors.email[0]}</p>}
              </div>
              <div>
                <label htmlFor="user-password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password {modal === 'edit' && <span className="font-normal text-slate-500">(leave blank to keep current)</span>}
                </label>
                <input
                  id="user-password"
                  type="password"
                  required={modal === 'add'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputClass('password')}
                />
                {formErrors.password && <p className="mt-1 text-xs text-rose-600">{formErrors.password[0]}</p>}
              </div>
              <div>
                <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className={inputClass('role')}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                {formErrors.role && <p className="mt-1 text-xs text-rose-600">{formErrors.role[0]}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : modal === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
