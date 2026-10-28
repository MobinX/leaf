-- Leaf team invitations (D1). Applied via `cf d1 migrations apply leaf-db`.
-- The Worker also runs these statements with IF NOT EXISTS on first API hit,
-- so local dev works before any manual migrate.

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_uid TEXT,
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  uid TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, email),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_title TEXT NOT NULL,
  inviter_uid TEXT,
  inviter_email TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON invitations(invitee_email, status);
CREATE INDEX IF NOT EXISTS idx_invitations_project ON invitations(project_id, status);
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
