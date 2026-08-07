import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Consent } from './Consent.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('renders purpose cards and grant controls', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Consent /></SimulationProvider>);
  expect(html).toContain('Purpose-bound consent');
  expect(html).toContain('application_baseline');
  expect(html).toContain('Grant consent');
});
