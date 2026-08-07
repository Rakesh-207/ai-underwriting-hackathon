import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell, ApplicantRoute, AuditRoute, BehaviorRoute, ConsentRoute, FairnessRoute, OverviewRoute, ScoreRoute } from './index.ts';
import { ProtectedRoute } from './ProtectedRoute.tsx';
import { hasUsableConsent } from './useSimulation.ts';

const authState = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@clerk/react', () => ({
  UserButton: () => null,
  useAuth: () => ({ isLoaded: true, isSignedIn: authState.signedIn, getToken: async () => 'test-token' }),
}));

function markup(element: ReactElement) {
  return renderToStaticMarkup(element);
}

describe('authenticated underwriting workspace routes', () => {
  it.each([
    ['overview', OverviewRoute, 'Simulation overview'],
    ['consent', ConsentRoute, 'Purpose-bound consent'],
    ['applicant', ApplicantRoute, 'Applicant baseline'],
    ['score', ScoreRoute, 'Reliability score'],
    ['behavior', BehaviorRoute, 'Behavior update'],
    ['fairness', FairnessRoute, 'Synthetic parity diagnostic'],
    ['audit', AuditRoute, 'Audit trail'],
  ])('%s renders its protected page content', (_path, Component, title) => {
    const html = markup(<MemoryRouter><Component /></MemoryRouter>);
    expect(html).toContain(title);
  });

  it('keeps the simulation-only banner in the app shell', () => {
    const html = markup(<MemoryRouter><AppShell /></MemoryRouter>);
    expect(html).toContain('Simulation only');
    expect(html).toContain('It does not produce a real lending outcome.');
  });
});

describe('workspace boundaries', () => {
  it('does not render protected content for an unauthenticated user', () => {
    authState.signedIn = false;
    const html = markup(
      <MemoryRouter initialEntries={['/app/score']}>
        <Routes>
          <Route path="/app/score" element={<ProtectedRoute><div>private</div></ProtectedRoute>} />
          <Route path="/sign-in" element={<div>sign-in</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // Navigate intentionally renders no HTML during server rendering. The
    // important boundary is that private content is never emitted.
    expect(html).not.toContain('private');
    authState.signedIn = true;
  });

  it('blocks alternative data without a granted receipt', () => {
    expect(hasUsableConsent(null)).toBe(false);
    expect(hasUsableConsent({ status: 'revoked' } as never)).toBe(false);
    expect(hasUsableConsent({ status: 'granted' } as never)).toBe(true);
  });
});
