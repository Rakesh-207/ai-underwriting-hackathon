import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Overview } from './Overview.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('renders the simulation dashboard and start action', () => {
  const html = renderToStaticMarkup(<SimulationProvider><MemoryRouter><Overview /></MemoryRouter></SimulationProvider>);
  expect(html).toContain('Simulation overview');
  expect(html).toContain('Start a new simulation');
  expect(html).toContain('Awaiting consent');
});
