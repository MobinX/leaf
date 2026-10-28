-- D1 document storage (one row set per document tab).
-- The Yjs state is gzip-compressed client-side, base64-encoded over HTTP, and
-- stored here as BLOB chunks: D1 caps a single string/BLOB/row at 2,000,000
-- bytes, so payloads are split into ~1.5MB pieces and reassembled on read.
-- The CRDT snapshot is always a full compacted `Y.encodeStateAsUpdate`, never
-- rebuilt from plain text, so item identity (and every stored anchor) survives.

CREATE TABLE IF NOT EXISTS doc_meta (
  project_id TEXT NOT NULL,
  tab_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  byte_size INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  PRIMARY KEY (project_id, tab_name),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  project_id TEXT NOT NULL,
  tab_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (project_id, tab_name, chunk_index),
  FOREIGN KEY (project_id, tab_name) REFERENCES doc_meta(project_id, tab_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_meta_project ON doc_meta(project_id);
