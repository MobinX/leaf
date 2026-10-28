-- Share links: unguessable tokens that grant document access to anyone who
-- holds them, without an account. One document can have many links, each with
-- its own permission: 'reader' (read-only) or 'editor' (read + save).
-- Editors appointed by invite are unaffected; links are an additional door.

CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'reader',
  label TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_project ON share_links(project_id);
