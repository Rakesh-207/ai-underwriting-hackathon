import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Behavior } from './Behavior.tsx';

test('applies a behavior update and shows score delta', () => {
  const html = renderToStaticMarkup(<Behavior />);
  expect(html).toContain('Apply behavior update');
  expect(html).toContain('before/after result');
});
