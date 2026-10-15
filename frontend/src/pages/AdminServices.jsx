import { useMemo, useState } from 'react';
import {
  getAdminServices, createService, updateService, deleteService,
  getCategories, createCategory, updateCategory, deleteCategory,
  getAdminStaff,
} from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { formatMoney, formatDuration } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Checkbox, Field, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from '../components/Fields.jsx';

function ServiceModal({ service, categories, staffList, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    duration_minutes: service?.duration_minutes ?? 45,
    buffer_minutes: service?.buffer_minutes ?? 10,
    price_cents: service ? Math.round(service.price_cents / 100) : 25,
    category_id: service?.category_id || categories[0]?.id || '',
    bookable_online: service?.bookable_online ?? true,
    active: service ? (service.active ?? service.is_active) : true,
    staff_ids: service?.staff_ids || [],
  });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleStaff = (id) =>
    setForm((f) => ({
      ...f,
      staff_ids: f.staff_ids.includes(id) ? f.staff_ids.filter((x) => x !== id) : [...f.staff_ids, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setWorking(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        duration_minutes: Number(form.duration_minutes),
        buffer_minutes: Number(form.buffer_minutes),
        price_cents: Math.round(Number(form.price_cents) * 100),
        category_id: Number(form.category_id),
        bookable_online: form.bookable_online,
        active: form.active,
        staff_ids: form.staff_ids,
      };
      if (service) await updateService(service.id, payload);
      else await createService(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title={service ? 'Edit service' : 'New service'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" required>
            <TextInput value={form.name} onChange={set('name')} required placeholder="e.g. Signature Haircut" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <TextArea value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <Field label="Duration (minutes)" required>
          <TextInput type="number" min="5" step="5" value={form.duration_minutes} onChange={set('duration_minutes')} required />
        </Field>
        <Field label="Buffer (minutes)" hint="Cleanup time blocked after the appointment">
          <TextInput type="number" min="0" step="5" value={form.buffer_minutes} onChange={set('buffer_minutes')} />
        </Field>
        <Field label="Price (USD)" required>
          <TextInput type="number" min="0" step="0.01" value={form.price_cents} onChange={set('price_cents')} required />
        </Field>
        <Field label="Category" required>
          <SelectInput value={form.category_id} onChange={set('category_id')} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectInput>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Specialists who perform this service">
            <div className="flex flex-wrap gap-2">
              {staffList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStaff(s.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    form.staff_ids.includes(s.id)
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-rose-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <Checkbox label="Bookable online" hint="Show on the public booking site" checked={form.bookable_online} onChange={(e) => setForm((f) => ({ ...f, bookable_online: e.target.checked }))} />
          <Checkbox label="Active" hint="Inactive services are hidden everywhere" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={working}>{working ? 'Saving…' : 'Save service'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: category?.name || '',
    sort_order: category?.sort_order ?? 0,
    active: category?.active ?? true,
  });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setWorking(true);
    try {
      const payload = { name: form.name.trim(), sort_order: Number(form.sort_order), active: form.active };
      if (category) await updateCategory(category.id, payload);
      else await createCategory(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>
        <Field label="Sort order">
          <TextInput type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
        </Field>
        <Checkbox label="Active" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={working}>{working ? 'Saving…' : 'Save'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminServices() {
  const [tab, setTab] = useState('services');
  const { data, loading, error, refetch } = useApi(getAdminServices, []);
  const { data: catData, refetch: refetchCats } = useApi(getCategories, []);
  const { data: staffData } = useApi(getAdminStaff, []);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [editingCat, setEditingCat] = useState(undefined);
  const [notice, setNotice] = useState('');

  const services = data?.services || [];
  const categories = catData?.categories || [];
  const staffList = staffData?.staff || [];
  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const saved = () => {
    setEditing(undefined);
    setNotice('Service saved.');
    refetch();
  };
  const catSaved = () => {
    setEditingCat(undefined);
    setNotice('Category saved.');
    refetchCats();
  };

  const removeService = async (id) => {
    if (!window.confirm('Deactivate this service? It will be hidden from booking.')) return;
    try {
      await deleteService(id);
      setNotice('Service deactivated.');
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };
  const removeCategory = async (id) => {
    if (!window.confirm('Deactivate this category?')) return;
    try {
      await deleteCategory(id);
      setNotice('Category deactivated.');
      refetchCats();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {['services', 'categories'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'services'
            ? <PrimaryButton onClick={() => setEditing(null)}>+ New service</PrimaryButton>
            : <PrimaryButton onClick={() => setEditingCat(null)}>+ New category</PrimaryButton>}
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</div>
      )}

      {tab === 'services' && (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : services.length === 0 ? (
            <div className="p-6"><EmptyState title="No services yet" hint="Create your first service to start taking bookings." /></div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="px-5 py-3 font-semibold">Service</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Duration</th>
                  <th className="px-5 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">Online</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="max-w-xs truncate text-xs text-slate-400">{s.description}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{catName[s.category_id] || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDuration(s.duration_minutes)} <span className="text-slate-400">+{s.buffer_minutes}m</span></td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{formatMoney(s.price_cents)}</td>
                    <td className="px-5 py-3.5">{s.bookable_online ? '✓' : '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={(s.active ?? s.is_active) ? 'approved' : 'declined'} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(s)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => removeService(s.id)} className="text-sm font-medium text-rose-600 hover:text-rose-800">Deactivate</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.sort_order}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.active ? 'approved' : 'declined'} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingCat(c)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => removeCategory(c.id)} className="text-sm font-medium text-rose-600 hover:text-rose-800">Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <ServiceModal service={editing} categories={categories} staffList={staffList} onClose={() => setEditing(undefined)} onSaved={saved} />
      )}
      {editingCat !== undefined && (
        <CategoryModal category={editingCat} onClose={() => setEditingCat(undefined)} onSaved={catSaved} />
      )}
    </div>
  );
}
