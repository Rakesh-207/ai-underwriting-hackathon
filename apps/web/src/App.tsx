import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AppShell } from './components/AppShell.tsx';
import { SimulationBanner } from './components/SimulationBanner.tsx';
import { Landing } from './features/marketing/Landing.tsx';
import { Overview } from './routes/Overview.tsx';
import { Applications } from './routes/Applications.tsx';
import { NewApplication } from './routes/NewApplication.tsx';
import { ApplicationDetail } from './routes/ApplicationDetail.tsx';
import { SignInRoute } from './routes/SignInRoute.tsx';
import { SignUpRoute } from './routes/SignUpRoute.tsx';
import { ApplicationsProvider } from './hooks/useApplications.tsx';

function PublicLanding() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }
  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }
  return <Landing />;
}

function AuthenticatedWorkspace() {
  const { getToken } = useAuth();
  return <ApplicationsProvider getToken={getToken}><AppShell /></ApplicationsProvider>;
}

export function App() {
  return (
    <Routes>
      {/* Public routes (auth contract 4.1) */}
      <Route path="/" element={<PublicLanding />} />
      <Route path="/sign-in" element={<SignInRoute />} />
      <Route path="/sign-up" element={<SignUpRoute />} />

      {/* Protected /app routes (auth contract 4.2) */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AuthenticatedWorkspace />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="applications" element={<Applications />} />
        <Route path="applications/new" element={<NewApplication />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export { SimulationBanner };
