const styles = {
  booked: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
  no_show: 'bg-rose-100 text-rose-800',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-rose-100 text-rose-800',
  sent: 'bg-emerald-100 text-emerald-800',
  queued: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-800',
};

const labels = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export default function StatusBadge({ status }) {
  const cls = styles[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {labels[status] || status}
    </span>
  );
}
