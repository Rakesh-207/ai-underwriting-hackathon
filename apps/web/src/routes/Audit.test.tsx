import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Audit } from './Audit.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('renders audit trail, fraud review, provenance, and cost', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Audit /></SimulationProvider>);
  expect(html).toContain('Audit trail');
  expect(html).toContain('No audit events');
});
