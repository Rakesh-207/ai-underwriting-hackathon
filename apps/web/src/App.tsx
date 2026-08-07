import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AppShell } from './components/AppShell.tsx';
import { SimulationBanner } from './components/SimulationBanner.tsx';
import { Landing } from './routes/Landing.tsx';
import { WorkbenchPlaceholder } from './routes/WorkbenchPlaceholder.tsx';
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
  return <Landing />;
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
        <Route
          path="overview"
          element={<WorkbenchPlaceholder routeName="Overview" />}
        />
        <Route
          path="consent"
          element={<WorkbenchPlaceholder routeName="Consent" />}
        />
        <Route
          path="applicant"
          element={<WorkbenchPlaceholder routeName="Applicant" />}
        />
        <Route
          path="score"
          element={<WorkbenchPlaceholder routeName="Score" />}
        />
        <Route
          path="behavior"
          element={<WorkbenchPlaceholder routeName="Behavior" />}
        />
        <Route
          path="fairness"
          element={<WorkbenchPlaceholder routeName="Fairness" />}
        />
        <Route
          path="audit"
          element={<WorkbenchPlaceholder routeName="Audit" />}
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export { SimulationBanner };
