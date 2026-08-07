import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AppShell } from './components/AppShell.tsx';
import { SimulationBanner } from './components/SimulationBanner.tsx';
import { LandingPlaceholder } from './routes/LandingPlaceholder.tsx';
import { Overview } from './routes/Overview.tsx';
import { Consent } from './routes/Consent.tsx';
import { Applicant } from './routes/Applicant.tsx';
import { Score } from './routes/Score.tsx';
import { Behavior } from './routes/Behavior.tsx';
import { Fairness } from './routes/Fairness.tsx';
import { Audit } from './routes/Audit.tsx';
import { SignInRoute } from './routes/SignInRoute.tsx';
import { SignUpRoute } from './routes/SignUpRoute.tsx';

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
  return <LandingPlaceholder />;
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
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="consent" element={<Consent />} />
        <Route path="applicant" element={<Applicant />} />
        <Route path="score" element={<Score />} />
        <Route path="behavior" element={<Behavior />} />
        <Route path="fairness" element={<Fairness />} />
        <Route path="audit" element={<Audit />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export { SimulationBanner };
