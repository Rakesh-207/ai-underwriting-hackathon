import type { ErrorEnvelope, ErrorCode } from '@underwriting/shared';
import { API_SCHEMA_VERSION } from '@underwriting/shared';

// Build the shared ErrorEnvelope at schemaVersion 1.1.
// auth contract 3.2: the version "1.1" applies to all responses under this
// contract (success and error alike), not just 401/auth errors.
export function errorEnvelope(
  errorCode: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors: Record<string, string[]> = {},
): ErrorEnvelope {
  return {
    schemaVersion: API_SCHEMA_VERSION,
    errorCode,
    message,
    fieldErrors,
    requestId,
  };
}

// Generate an opaque request ID for tracing. No personal data.
export function generateRequestId(): string {
  return `req-${crypto.randomUUID()}`;
}

// Build a JSON Response carrying an ErrorEnvelope.
export function errorResponse(
  errorCode: ErrorCode,
  message: string,
  requestId: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
): Response {
  return new Response(
    JSON.stringify(errorEnvelope(errorCode, message, requestId, fieldErrors)),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );
}
