import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Score } from './Score.tsx';

test('renders score comparison, risk band, and evidence ledger', () => {
  const html = renderToStaticMarkup(<Score />);
  expect(html).toContain('Reliability score');
  expect(html).toContain('Baseline score');
  expect(html).toContain('Evidence ledger');
  expect(html).toContain('supports');
});
