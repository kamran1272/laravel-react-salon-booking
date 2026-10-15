import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function AuthGate({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function ProtectedRoute({ children }) {
  return <AuthGate>{children}</AuthGate>;
}

export function AdminRoute({ children }) {
  const { user } = useAuth();
  return (
    <AuthGate>
      {user?.role === 'admin' ? children : <Navigate to="/" replace />}
    </AuthGate>
  );
}

/** roles: e.g. ['staff', 'admin'] */
export function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  return (
    <AuthGate>
      {roles.includes(user?.role) ? children : <Navigate to="/" replace />}
    </AuthGate>
  );
}
