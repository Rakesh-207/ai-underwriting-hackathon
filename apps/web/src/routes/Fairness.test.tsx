import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Fairness } from './Fairness.tsx';

test('renders synthetic cohort diagnostics and limitations', () => {
  const html = renderToStaticMarkup(<Fairness />);
  expect(html).toContain('Fairness diagnostic');
  expect(html).toContain('<table');
  expect(html).toContain('Synthetic evaluation labels');
  expect(html).toContain('Limitations');
});
