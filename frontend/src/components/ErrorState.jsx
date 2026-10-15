import { apiErrorMessage } from '../hooks/useApi.js';

export default function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
      <p className="font-semibold text-rose-800">{title}</p>
      <p className="mt-1 text-sm text-rose-700">{apiErrorMessage(error)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
