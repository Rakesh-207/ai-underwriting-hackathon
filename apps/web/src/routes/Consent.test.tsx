import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Consent } from './Consent.tsx';

test('renders purpose cards and grant controls', () => {
  const html = renderToStaticMarkup(<Consent />);
  expect(html).toContain('Purpose-bound consent');
  expect(html).toContain('application_baseline');
  expect(html).toContain('Revoke consent');
});
