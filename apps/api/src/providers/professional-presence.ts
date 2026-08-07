import type { AlternativeDataSource, ConsentContext, RawProviderResponse } from '@underwriting/shared';

export interface ProfessionalPresenceProvider {
  readonly source: Extract<AlternativeDataSource, 'professional_presence'>;
  fetch(input: { consent: ConsentContext }): Promise<RawProviderResponse<never>>;
}
