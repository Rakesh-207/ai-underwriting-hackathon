import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Fairness } from './Fairness.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('renders synthetic cohort diagnostics and limitations', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Fairness /></SimulationProvider>);
  expect(html).toContain('Fairness diagnostic');
  expect(html).toContain('Synthetic cohort labels');
});
