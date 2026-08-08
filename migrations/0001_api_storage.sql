CREATE TABLE IF NOT EXISTS applications (
  simulation_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  application_json TEXT NOT NULL,
  declared_employment_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS applications_owner_idx ON applications (clerk_user_id);

CREATE TABLE IF NOT EXISTS consent_receipts (
  consent_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  receipt_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS consent_owner_idx ON consent_receipts (clerk_user_id, simulation_id);

CREATE TABLE IF NOT EXISTS score_snapshots (
  score_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  score_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS behavior_updates (
  update_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  update_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  event_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_owner_idx ON audit_events (clerk_user_id, simulation_id);
