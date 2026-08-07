import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Applicant } from './Applicant.tsx';
import { SimulationProvider } from '../hooks/useWorkspace.tsx';
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

test('shows the synthetic applicant profile behind baseline consent', () => {
  const html = renderToStaticMarkup(<SimulationProvider><Applicant /></SimulationProvider>);
  expect(html).toContain('Synthetic applicant');
  expect(html).toContain('Grant application-baseline consent');
});
