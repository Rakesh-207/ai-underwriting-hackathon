import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div role="status" className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">Preparing secure session…</div>;
  if (!isSignedIn) return <Navigate to={`/sign-in?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}
