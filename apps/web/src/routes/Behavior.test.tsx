import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Behavior } from './Behavior.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('applies a behavior update and shows score delta', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Behavior /></SimulationProvider>);
  expect(html).toContain('Apply behavior update');
  expect(html).toContain('API-owned');
});
