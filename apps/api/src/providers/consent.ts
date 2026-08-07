import type { AlternativeDataSource, ConsentContext, ConsentScope } from '@underwriting/shared';

export class ConsentRequiredError extends Error {
  public readonly code = 'CONSENT_REQUIRED';

  constructor(source: AlternativeDataSource, scopes: readonly ConsentScope[]) {
    super(`Consent is required for ${source}: ${scopes.join(', ')}`);
    this.name = 'ConsentRequiredError';
  }
}

export function requireConsent(
  consent: ConsentContext | undefined,
  source: AlternativeDataSource,
  requiredScopes: readonly ConsentScope[],
): ConsentContext {
  if (
    !consent ||
    consent.source !== source ||
    !requiredScopes.every((scope) => consent.scopes.includes(scope)) ||
    !consent.consentReference ||
    !consent.timestamp
  ) {
    throw new ConsentRequiredError(source, requiredScopes);
  }

  return consent;
}
