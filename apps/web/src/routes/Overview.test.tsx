import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Overview } from './Overview.tsx';
import { ApplicationsProvider } from '../hooks/useApplications.tsx';

test('renders an empty application state without seeding a record', () => {
  localStorage.clear();
  const html = renderToStaticMarkup(<ApplicationsProvider><MemoryRouter><Overview /></MemoryRouter></ApplicationsProvider>);
  expect(html).toContain('Your applications');
  expect(html).toContain('Load synthetic example');
  expect(html).not.toContain('Synthetic Applicant A');
});
