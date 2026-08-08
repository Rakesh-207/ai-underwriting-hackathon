import { expect, test } from 'vitest';
import { toDisplayError } from './types.ts';

test('converts unknown transport failures into display-safe retryable errors', () => {
  expect(toDisplayError(new Error('private provider stack trace'))).toEqual({
    code: 'unknown',
    message: 'The underwriting agent could not complete this response.',
    retryable: true,
  });
});
