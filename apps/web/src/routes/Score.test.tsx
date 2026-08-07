import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Score } from './Score.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('renders score comparison, risk band, and evidence ledger', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Score /></SimulationProvider>);
  expect(html).toContain('Reliability score');
  expect(html).toContain('Grant application-baseline consent');
});
