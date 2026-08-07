import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Audit } from './Audit.tsx';

test('renders audit trail, fraud review, provenance, and cost', () => {
  const html = renderToStaticMarkup(<Audit />);
  expect(html).toContain('Audit trail');
  expect(html).toContain('Fraud review');
  expect(html).toContain('Cost breakdown');
  expect(html).toContain('Provenance');
});
