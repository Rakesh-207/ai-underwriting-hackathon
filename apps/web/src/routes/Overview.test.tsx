import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Overview } from './Overview.tsx';

test('renders the simulation dashboard and start action', () => {
  const html = renderToStaticMarkup(<MemoryRouter><Overview /></MemoryRouter>);
  expect(html).toContain('Simulation overview');
  expect(html).toContain('Start a new simulation');
  expect(html).toContain('synthetic-applicant-v1');
});
