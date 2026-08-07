-- Deferred D1 schema: only consent receipts, audit events, and demo snapshots.
CREATE TABLE IF NOT EXISTS consent_receipts (
  consent_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  identity_provider TEXT NOT NULL,
  purposes_json TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  retention TEXT NOT NULL,
  receipt_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  model_version TEXT,
  feature_registry_version TEXT,
  consent_ids_json TEXT NOT NULL,
  provenance_refs_json TEXT NOT NULL,
  detail_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_snapshots (
  simulation_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
