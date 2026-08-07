import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';

// Renders a full-screen skeleton while Clerk initializes. No protected route
// assumes getToken() is synchronous or non-null. (auth contract 1.2)
function ClerkLoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-sm text-muted">Preparing secure session…</p>
      </div>
    </div>
  );
}

// ProtectedRoute: requires Clerk authentication. Unauthenticated users are
// redirected to /sign-in with the return URL preserved. (auth contract 4.3)
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <ClerkLoadingSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ returnTo: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
