import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Applicant } from './Applicant.tsx';

test('shows the synthetic applicant profile behind baseline consent', () => {
  const html = renderToStaticMarkup(<Applicant />);
  expect(html).toContain('Synthetic applicant');
  expect(html).toContain('Bureau score');
  expect(html).toContain('synthetic fixture');
});
