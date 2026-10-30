import { Hono } from "hono";
import {
  createSessionCookie,
  resolveIdentity,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./firebaseAuth";

export type TeamEnv = {
  Bindings: {
    DB: D1Database;
    FIREBASE_PROJECT_ID?: string;
    REQUIRE_AUTH?: string;
    FIREBASE_CLIENT_EMAIL?: string;
    FIREBASE_PRIVATE_KEY?: string;
  };
};

const SCHEMA = `
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
`;

let schemaReady = false;

async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  const statements = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sql of statements) {
    await db.prepare(sql).run();
  }
  schemaReady = true;
}

function unauthorized(c: { json: (body: unknown, status: number) => Response }) {
  return c.json({ error: "Sign in required." }, 401);
}

export function teamRoutes() {
  const api = new Hono<TeamEnv>();

  /* ---------------------------------------------------------------- */
  /*  Session cookie — lets the server render authenticated pages      */
  /* ---------------------------------------------------------------- */

  // Exchange a Firebase ID token for a long-lived session cookie.
  // The cookie is HttpOnly, so it cannot be read by scripts; the server
  // verifies it on every request (see `resolveIdentity`).
  api.post("/api/session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const idToken =
      typeof body.idToken === "string" ? body.idToken.trim() : "";
    if (!idToken) return c.json({ error: "idToken is required." }, 400);
    try {
      const session = await createSessionCookie(idToken, c.env);
      if (!session) {
        return c.json(
          { error: "Session cookies are not configured on this deployment." },
          501,
        );
      }
      const secure = new URL(c.req.url).protocol === "https:";
      c.header(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`,
      );
      return c.json({ ok: true });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Could not create a session." },
        502,
      );
    }
  });

  // Drop the session cookie (sign-out).
  api.post("/api/session/clear", (c) => {
    const secure = new URL(c.req.url).protocol === "https:";
    c.header(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
    );
    return c.json({ ok: true });
  });

  // Who am I? Lets the client confirm the session cookie works.
  api.get("/api/session", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    return c.json({
      user: { uid: identity.uid, email: identity.email, name: identity.name },
    });
  });

  // Every document the caller can open: owned projects plus projects they
  // were added to. Includes the saved tab list so the client can render the
  // whole home page from one response.
  api.get("/api/documents", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const email = identity.email;
    const projects = await db
      .prepare(
        `SELECT p.id AS id, p.title AS title, p.created_at AS created_at,
                p.updated_at AS updated_at, p.owner_email AS owner_email,
                pm.role AS member_role,
                (SELECT MAX(dm.updated_at) FROM doc_meta dm WHERE dm.project_id = p.id) AS content_updated_at
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.email = ?
          WHERE p.owner_email = ? OR pm.email IS NOT NULL
          ORDER BY COALESCE((SELECT MAX(dm2.updated_at) FROM doc_meta dm2 WHERE dm2.project_id = p.id), p.updated_at) DESC`,
      )
      .bind(email, email)
      .all<{
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
        owner_email: string;
        member_role: string | null;
        content_updated_at: string | null;
      }>();

    const list = projects.results ?? [];
    const tabsByProject: Record<string, { name: string; title: string; updatedAt: string; updatedBy: string | null }[]> = {};
    if (list.length > 0) {
      const placeholders = list.map(() => "?").join(",");
      const tabs = await db
        .prepare(
          `SELECT project_id, tab_name, title, updated_at, updated_by
             FROM doc_meta
            WHERE project_id IN (${placeholders})
            ORDER BY tab_name ASC`,
        )
        .bind(...list.map((p) => p.id))
        .all<{
          project_id: string;
          tab_name: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        }>();
      for (const row of tabs.results ?? []) {
        const bucket = (tabsByProject[row.project_id] ??= []);
        bucket.push({
          name: row.tab_name,
          title: row.title,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
        });
      }
    }

    return c.json({
      documents: list.map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.created_at,
        updatedAt: p.content_updated_at ?? p.updated_at,
        role:
          p.owner_email.toLowerCase() === email.toLowerCase()
            ? "owner"
            : (p.member_role ?? "editor"),
        tabs: tabsByProject[p.id] ?? [],
      })),
    });
  });

  // Delete a document (owner only). Cascades to members, tabs and snapshots.
  api.delete("/api/projects/:id", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const project = await db
      .prepare("SELECT id, owner_email FROM projects WHERE id = ?")
      .bind(projectId)
      .first<{ id: string; owner_email: string }>();
    if (!project) return c.json({ error: "Project not found." }, 404);
    if (project.owner_email.toLowerCase() !== identity.email.toLowerCase()) {
      return c.json({ error: "Only the owner can delete this document." }, 403);
    }
    await db.batch([
      db.prepare("DELETE FROM doc_chunks WHERE project_id = ?").bind(projectId),
      db.prepare("DELETE FROM doc_meta WHERE project_id = ?").bind(projectId),
      db.prepare("DELETE FROM project_members WHERE project_id = ?").bind(projectId),
      db.prepare("DELETE FROM share_links WHERE project_id = ?").bind(projectId),
      db.prepare("DELETE FROM invitations WHERE project_id = ?").bind(projectId),
      db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId),
    ]);
    return c.json({ ok: true });
  });

  // Register/update the signed-in user. Called once after Firebase login.
  api.post("/api/users/upsert", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const body = await c.req.json().catch(() => ({}));
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : identity.name;
    const photo =
      typeof body.photo === "string" ? body.photo.slice(0, 500) : identity.picture ?? null;
    await db
      .prepare(
        `INSERT INTO users (uid, email, name, photo_url, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(uid) DO UPDATE SET email=excluded.email, name=excluded.name,
           photo_url=excluded.photo_url, updated_at=datetime('now')`,
      )
      .bind(identity.uid, identity.email, name, photo)
      .run();
    return c.json({ user: { uid: identity.uid, email: identity.email, name } });
  });

  // Ensure a project row exists for a document. The first caller becomes owner.
  api.post("/api/projects/ensure", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const body = await c.req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 200) : "";
    if (!id) return c.json({ error: "Project id is required." }, 400);
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : id;
    const existing = await db
      .prepare("SELECT id, title, owner_email FROM projects WHERE id = ?")
      .bind(id)
      .first<{ id: string; title: string; owner_email: string }>();
    if (!existing) {
      await db
        .prepare(
          "INSERT INTO projects (id, title, owner_uid, owner_email) VALUES (?, ?, ?, ?)",
        )
        .bind(id, title, identity.uid, identity.email)
        .run();
      await db
        .prepare(
          "INSERT OR IGNORE INTO project_members (project_id, uid, email, role) VALUES (?, ?, ?, 'owner')",
        )
        .bind(id, identity.uid, identity.email)
        .run();
      return c.json({
        project: { id, title, ownerEmail: identity.email, role: "owner" },
      });
    }
    const membership = await db
      .prepare("SELECT role FROM project_members WHERE project_id = ? AND email = ?")
      .bind(id, identity.email)
      .first<{ role: string }>();
    const isOwner =
      existing.owner_email.toLowerCase() === identity.email.toLowerCase();
    if (!isOwner && !membership) {
      return c.json({ error: "You are not a member of this project." }, 403);
    }
    return c.json({
      project: {
        id: existing.id,
        title: existing.title,
        ownerEmail: existing.owner_email,
        role: isOwner ? "owner" : (membership?.role ?? "editor"),
      },
    });
  });

  // Members + pending invites for one project (owner or member only).
  api.get("/api/projects/:id/members", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const id = c.req.param("id");
    const project = await db
      .prepare("SELECT id, title, owner_email FROM projects WHERE id = ?")
      .bind(id)
      .first<{ id: string; title: string; owner_email: string }>();
    if (!project) return c.json({ error: "Project not found." }, 404);
    const membership = await db
      .prepare("SELECT role FROM project_members WHERE project_id = ? AND email = ?")
      .bind(id, identity.email)
      .first<{ role: string }>();
    const isOwner =
      project.owner_email.toLowerCase() === identity.email.toLowerCase();
    if (!isOwner && !membership) {
      return c.json({ error: "You are not a member of this project." }, 403);
    }
    const members = await db
      .prepare(
        "SELECT email, role, added_at FROM project_members WHERE project_id = ? ORDER BY added_at ASC",
      )
      .bind(id)
      .all<{ email: string; role: string; added_at: string }>();
    const pending = await db
      .prepare(
        "SELECT id, invitee_email, status, created_at FROM invitations WHERE project_id = ? AND status = 'pending' ORDER BY created_at DESC",
      )
      .bind(id)
      .all<{ id: string; invitee_email: string; status: string; created_at: string }>();
    return c.json({
      project: { id: project.id, title: project.title, ownerEmail: project.owner_email },
      members: members.results ?? [],
      pending: pending.results ?? [],
      myRole: isOwner ? "owner" : (membership?.role ?? "editor"),
    });
  });

  // Invite by email. Caller must already belong to the project (or own it).
  api.post("/api/invites", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const body = await c.req.json().catch(() => ({}));
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim().slice(0, 200) : "";
    const projectTitle =
      typeof body.projectTitle === "string" && body.projectTitle.trim()
        ? body.projectTitle.trim().slice(0, 200)
        : projectId;
    const inviteeEmail =
      typeof body.inviteeEmail === "string"
        ? body.inviteeEmail.trim().toLowerCase()
        : "";
    if (!projectId) return c.json({ error: "Project id is required." }, 400);
    if (!inviteeEmail.includes("@")) {
      return c.json({ error: "Enter a valid email address." }, 400);
    }
    if (inviteeEmail === identity.email) {
      return c.json({ error: "You cannot invite yourself." }, 400);
    }
    const project = await db
      .prepare("SELECT id, owner_email FROM projects WHERE id = ?")
      .bind(projectId)
      .first<{ id: string; owner_email: string }>();
    if (!project) {
      await db
        .prepare("INSERT INTO projects (id, title, owner_uid, owner_email) VALUES (?, ?, ?, ?)")
        .bind(projectId, projectTitle, identity.uid, identity.email)
        .run();
      await db
        .prepare("INSERT OR IGNORE INTO project_members (project_id, uid, email, role) VALUES (?, ?, ?, 'owner')")
        .bind(projectId, identity.uid, identity.email)
        .run();
    } else {
      const isOwner =
        project.owner_email.toLowerCase() === identity.email.toLowerCase();
      const membership = await db
        .prepare("SELECT role FROM project_members WHERE project_id = ? AND email = ?")
        .bind(projectId, identity.email)
        .first<{ role: string }>();
      if (!isOwner && !membership) {
        return c.json({ error: "Only project members can invite." }, 403);
      }
    }
    const alreadyMember = await db
      .prepare("SELECT email FROM project_members WHERE project_id = ? AND email = ?")
      .bind(projectId, inviteeEmail)
      .first();
    if (alreadyMember) {
      return c.json({ error: "That user is already on this project." }, 409);
    }
    const alreadyPending = await db
      .prepare(
        "SELECT id FROM invitations WHERE project_id = ? AND invitee_email = ? AND status = 'pending'",
      )
      .bind(projectId, inviteeEmail)
      .first<{ id: string }>();
    if (alreadyPending) {
      return c.json({ error: "An invite is already pending for that email." }, 409);
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db
      .prepare(
        `INSERT INTO invitations
           (id, project_id, project_title, inviter_uid, inviter_email, invitee_email, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, projectId, projectTitle, identity.uid, identity.email, inviteeEmail)
      .run();
    return c.json({
      invite: { id, projectId, projectTitle, inviteeEmail, status: "pending" },
    });
  });

  // Invitation inbox for the signed-in user (the notification source).
  api.get("/api/invites/inbox", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const status = c.req.query("status") || "pending";
    const rows = await db
      .prepare(
        `SELECT id, project_id, project_title, inviter_email, invitee_email, status, created_at
         FROM invitations WHERE invitee_email = ? AND status = ?
         ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(identity.email, status)
      .all();
    return c.json({ invites: rows.results ?? [] });
  });

  // Invites this user sent (per-project management).
  api.get("/api/invites/sent", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.query("projectId");
    const rows = projectId
      ? await db
          .prepare(
            `SELECT id, project_id, project_title, invitee_email, status, created_at
             FROM invitations WHERE project_id = ? AND inviter_email = ?
             ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(projectId, identity.email)
          .all()
      : await db
          .prepare(
            `SELECT id, project_id, project_title, invitee_email, status, created_at
             FROM invitations WHERE inviter_email = ?
             ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(identity.email)
          .all();
    return c.json({ invites: rows.results ?? [] });
  });

  // Accept: only the invited email can accept; adds them to the team.
  api.post("/api/invites/:id/accept", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const id = c.req.param("id");
    const invite = await db
      .prepare("SELECT * FROM invitations WHERE id = ?")
      .bind(id)
      .first<{
        id: string;
        project_id: string;
        project_title: string;
        invitee_email: string;
        status: string;
      }>();
    if (!invite) return c.json({ error: "Invite not found." }, 404);
    if (invite.invitee_email.toLowerCase() !== identity.email) {
      return c.json({ error: "This invite was sent to a different email." }, 403);
    }
    if (invite.status !== "pending") {
      return c.json({ error: `Invite is already ${invite.status}.` }, 409);
    }
    await db
      .prepare("UPDATE invitations SET status = 'accepted', responded_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    await db
      .prepare(
        "INSERT OR IGNORE INTO project_members (project_id, uid, email, role) VALUES (?, ?, ?, 'editor')",
      )
      .bind(invite.project_id, identity.uid, identity.email)
      .run();
    await db
      .prepare("UPDATE project_members SET uid = ? WHERE project_id = ? AND email = ?")
      .bind(identity.uid, invite.project_id, identity.email)
      .run();
    return c.json({ ok: true, projectId: invite.project_id });
  });

  // ---- Document storage (compressed Yjs + JSON envelope, per document tab) ----

  const CHUNK_SIZE = 1_500_000;
  const MAX_CHUNKS = 16;
  const MAX_SNAPSHOT_CHARS = 50_000;

  function b64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function bytesToB64(data: Uint8Array | ArrayBuffer): string {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  async function requireProjectAccess(
    db: D1Database,
    projectId: string,
    email: string,
  ): Promise<
    | { project: { id: string; title: string; owner_email: string }; role: string }
    | { error: "not-found" | "forbidden" }
  > {
    const project = await db
      .prepare("SELECT id, title, owner_email FROM projects WHERE id = ?")
      .bind(projectId)
      .first<{ id: string; title: string; owner_email: string }>();
    if (!project) return { error: "not-found" };
    if (project.owner_email.toLowerCase() === email.toLowerCase()) {
      return { project, role: "owner" };
    }
    const membership = await db
      .prepare("SELECT role FROM project_members WHERE project_id = ? AND email = ?")
      .bind(projectId, email)
      .first<{ role: string }>();
    if (!membership) return { error: "forbidden" };
    return { project, role: membership.role };
  }

  // Save one tab: gzip-compressed Yjs update (base64) + a small JSON envelope
  // `{title, tab, savedAt, savedBy, ...}`. Large states are chunked because a
  // D1 row caps at 2MB. Only document editors may save.
  api.put("/api/projects/:id/doc", async (c) => {
    // Anonymous share-link holders carry no Firebase identity; they
    // authenticate with `x-share-token` instead (checked below).
    const identity = await resolveIdentity(c.req.raw, c.env);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const tab = typeof body.tab === "string" ? body.tab.trim().slice(0, 200) : "";
    if (!projectId || !tab) {
      return c.json({ error: "Project id and tab are required." }, 400);
    }
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : projectId;
    let snapshotJson = "{}";
    if (body.snapshot !== undefined) {
      if (typeof body.snapshot !== "object" || body.snapshot === null) {
        return c.json({ error: "Snapshot must be a JSON object." }, 400);
      }
      snapshotJson = JSON.stringify(body.snapshot);
      if (snapshotJson.length > MAX_SNAPSHOT_CHARS) {
        return c.json({ error: "Snapshot metadata is too large." }, 413);
      }
    }
    if (typeof body.stateB64 !== "string" || body.stateB64.length === 0) {
      return c.json({ error: "Compressed Yjs state (stateB64) is required." }, 400);
    }
    let bytes: Uint8Array;
    try {
      bytes = b64ToBytes(body.stateB64);
    } catch {
      return c.json({ error: "stateB64 is not valid base64." }, 400);
    }
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      chunks.push(bytes.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push(new Uint8Array(0));
    if (chunks.length > MAX_CHUNKS) {
      return c.json(
        { error: "Document is too large for D1 storage (over ~24MB compressed)." },
        413,
      );
    }

    const share = await resolveShareAccess(db, c.req.raw);
    if (!identity && !share) return unauthorized(c);
    let updatedBy = "Shared link";
    if (identity) {
      const memberAccess = await requireProjectAccess(db, projectId, identity.email);
      if (!("error" in memberAccess)) {
        updatedBy = identity.email;
      } else if (memberAccess.error === "not-found") {
        await db
          .prepare("INSERT INTO projects (id, title, owner_uid, owner_email) VALUES (?, ?, ?, ?)")
          .bind(projectId, title, identity.uid, identity.email)
          .run();
        await db
          .prepare("INSERT OR IGNORE INTO project_members (project_id, uid, email, role) VALUES (?, ?, ?, 'owner')")
          .bind(projectId, identity.uid, identity.email)
          .run();
        updatedBy = identity.email;
      } else if (share && share.projectId === projectId && share.permission === "editor") {
        updatedBy = "Shared link";
      } else {
        return c.json({ error: "Only document editors can save." }, 403);
      }
    } else {
      // No signed-in identity: a share-link editor must present its token.
      if (!(share && share.projectId === projectId && share.permission === "editor")) {
        return c.json({ error: "Only document editors can save." }, 403);
      }
      const existing = await db
        .prepare("SELECT id FROM projects WHERE id = ?")
        .bind(projectId)
        .first<{ id: string }>();
      if (!existing) {
        await db
          .prepare("INSERT INTO projects (id, title, owner_uid, owner_email) VALUES (?, ?, ?, ?)")
          .bind(projectId, title, "shared-link", "shared-link")
          .run();
      }
    }

    // NOTE: doc_meta must be upserted BEFORE the chunks are (re)written:
    // doc_chunks has a foreign key to doc_meta, and D1 enforces it, so
    // inserting chunks first fails on a tab's very first save.
    const statements = [
      db
        .prepare(
          `INSERT INTO doc_meta (project_id, tab_name, title, snapshot_json, chunk_count, byte_size, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
           ON CONFLICT(project_id, tab_name) DO UPDATE SET title=excluded.title,
             snapshot_json=excluded.snapshot_json, chunk_count=excluded.chunk_count,
             byte_size=excluded.byte_size, updated_at=datetime('now'), updated_by=excluded.updated_by`,
        )
        .bind(projectId, tab, title, snapshotJson, chunks.length, bytes.length, updatedBy),
      db.prepare("DELETE FROM doc_chunks WHERE project_id = ? AND tab_name = ?").bind(projectId, tab),
      ...chunks.map((chunk, i) =>
        db
          .prepare("INSERT INTO doc_chunks (project_id, tab_name, chunk_index, data) VALUES (?, ?, ?, ?)")
          .bind(projectId, tab, i, chunk.slice().buffer as ArrayBuffer),
      ),
    ];
    await db.batch(statements);
    return c.json({ ok: true, chunks: chunks.length, bytes: bytes.length });
  });

  // Load one tab: reassembled compressed Yjs state + JSON envelope.
  api.get("/api/projects/:id/doc", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const tab = (c.req.query("tab") ?? "").slice(0, 200);
    if (!tab) return c.json({ error: "Query param tab is required." }, 400);
    const share = await resolveShareAccess(db, c.req.raw);
    if (!identity && !share) return unauthorized(c);
    const memberAccess = identity
      ? await requireProjectAccess(db, projectId, identity.email)
      : null;
    if (
      (!memberAccess || "error" in memberAccess) &&
      (!share || share.projectId !== projectId)
    ) {
      const err = memberAccess && "error" in memberAccess ? memberAccess.error : "forbidden";
      return c.json(
        { error: err === "not-found" ? "Project not found." : "Only document editors can load." },
        err === "not-found" ? 404 : 403,
      );
    }
    const meta = await db
      .prepare("SELECT title, snapshot_json, chunk_count, byte_size, updated_at, updated_by FROM doc_meta WHERE project_id = ? AND tab_name = ?")
      .bind(projectId, tab)
      .first<{
        title: string;
        snapshot_json: string;
        chunk_count: number;
        byte_size: number;
        updated_at: string;
        updated_by: string | null;
      }>();
    if (!meta) return c.json({ empty: true }, 404);
    const rows = await db
      .prepare("SELECT data FROM doc_chunks WHERE project_id = ? AND tab_name = ? ORDER BY chunk_index ASC")
      .bind(projectId, tab)
      .all<{ data: ArrayBuffer }>();
    const parts = (rows.results ?? []).map((r) => new Uint8Array(r.data));
    const joined = new Uint8Array(meta.byte_size);
    let offset = 0;
    for (const part of parts) {
      joined.set(part, offset);
      offset += part.length;
    }
    let snapshot: Record<string, unknown> = {};
    try {
      snapshot = JSON.parse(meta.snapshot_json) as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
    return c.json({
      title: meta.title,
      snapshot,
      stateB64: bytesToB64(joined),
      chunkCount: meta.chunk_count,
      bytes: meta.byte_size,
      updatedAt: meta.updated_at,
      updatedBy: meta.updated_by,
    });
  });

  // List saved tabs for a document (metadata only, no blobs).
  api.get("/api/projects/:id/docs", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const share = await resolveShareAccess(db, c.req.raw);
    if (!identity && !share) return unauthorized(c);
    const memberAccess = identity
      ? await requireProjectAccess(db, projectId, identity.email)
      : null;
    if (
      (!memberAccess || "error" in memberAccess) &&
      (!share || share.projectId !== projectId)
    ) {
      const err = memberAccess && "error" in memberAccess ? memberAccess.error : "forbidden";
      return c.json(
        { error: err === "not-found" ? "Project not found." : "Only document editors can load." },
        err === "not-found" ? 404 : 403,
      );
    }
    const rows = await db
      .prepare("SELECT tab_name, title, chunk_count, byte_size, updated_at, updated_by FROM doc_meta WHERE project_id = ? ORDER BY tab_name ASC")
      .bind(projectId)
      .all();
    return c.json({ tabs: rows.results ?? [] });
  });

  // All saved tabs of a document in one response (compressed Yjs state per
  // tab). The server-side render uses this to hand the editor its content
  // without a client round trip.
  api.get("/api/projects/:id/snapshot", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const share = await resolveShareAccess(db, c.req.raw);
    if (!identity && !share) return unauthorized(c);
    const memberAccess = identity
      ? await requireProjectAccess(db, projectId, identity.email)
      : null;
    if (
      (!memberAccess || "error" in memberAccess) &&
      (!share || share.projectId !== projectId)
    ) {
      const err = memberAccess && "error" in memberAccess ? memberAccess.error : "forbidden";
      return c.json(
        { error: err === "not-found" ? "Project not found." : "Only document editors can load." },
        err === "not-found" ? 404 : 403,
      );
    }
    const metas = await db
      .prepare(
        "SELECT tab_name, title, chunk_count, byte_size, updated_at, updated_by FROM doc_meta WHERE project_id = ? ORDER BY tab_name ASC",
      )
      .bind(projectId)
      .all<{
        tab_name: string;
        title: string;
        chunk_count: number;
        byte_size: number;
        updated_at: string;
        updated_by: string | null;
      }>();
    const metasList = metas.results ?? [];
    if (metasList.length === 0) return c.json({ tabs: [] });

    const chunks = await db
      .prepare(
        "SELECT tab_name, chunk_index, data FROM doc_chunks WHERE project_id = ? ORDER BY tab_name ASC, chunk_index ASC",
      )
      .bind(projectId)
      .all<{ tab_name: string; chunk_index: number; data: ArrayBuffer }>();

    const byTab = new Map<string, Uint8Array[]>();
    for (const row of chunks.results ?? []) {
      const list = byTab.get(row.tab_name) ?? [];
      list.push(new Uint8Array(row.data));
      byTab.set(row.tab_name, list);
    }

    const tabs = metasList.map((meta) => {
      const parts = byTab.get(meta.tab_name) ?? [];
      const joined = new Uint8Array(meta.byte_size);
      let offset = 0;
      for (const part of parts) {
        joined.set(part, offset);
        offset += part.length;
      }
      return {
        name: meta.tab_name,
        title: meta.title,
        stateB64: bytesToB64(joined),
        chunkCount: meta.chunk_count,
        bytes: meta.byte_size,
        updatedAt: meta.updated_at,
        updatedBy: meta.updated_by,
      };
    });
    return c.json({ tabs });
  });

  // Reject: only the invited email can reject.
  api.post("/api/invites/:id/reject", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const id = c.req.param("id");
    const invite = await db
      .prepare("SELECT invitee_email, status FROM invitations WHERE id = ?")
      .bind(id)
      .first<{ invitee_email: string; status: string }>();
    if (!invite) return c.json({ error: "Invite not found." }, 404);
    if (invite.invitee_email.toLowerCase() !== identity.email) {
      return c.json({ error: "This invite was sent to a different email." }, 403);
    }
    if (invite.status !== "pending") {
      return c.json({ error: `Invite is already ${invite.status}.` }, 409);
    }
    await db
      .prepare("UPDATE invitations SET status = 'rejected', responded_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return c.json({ ok: true });
  });

  // ---- Share links (token access for non-members) ----

  type ShareAccess = { projectId: string; permission: string };

  async function resolveShareAccess(
    db: D1Database,
    request: Request,
  ): Promise<ShareAccess | null> {
    const token = request.headers.get("x-share-token")?.trim();
    if (!token) return null;
    const link = await db
      .prepare("SELECT project_id, permission FROM share_links WHERE token = ?")
      .bind(token)
      .first<{ project_id: string; permission: string }>();
    if (!link || (link.permission !== "reader" && link.permission !== "editor")) {
      return null;
    }
    return { projectId: link.project_id, permission: link.permission };
  }

  // Create a share link. Any document editor may create links.
  api.post("/api/projects/:id/links", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const access = await requireProjectAccess(db, projectId, identity.email);
    if ("error" in access) {
      return c.json(
        { error: access.error === "not-found" ? "Project not found." : "Only document editors can share." },
        access.error === "not-found" ? 404 : 403,
      );
    }
    const body = await c.req.json().catch(() => ({}));
    const permission = body.permission === "editor" ? "editor" : "reader";
    const label =
      typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
    const token = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO share_links (token, project_id, permission, label, created_by) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(token, projectId, permission, label, identity.email)
      .run();
    return c.json({ link: { token, permission, label, projectId } });
  });

  // List a document's share links. Editors only.
  api.get("/api/projects/:id/links", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const projectId = c.req.param("id");
    const access = await requireProjectAccess(db, projectId, identity.email);
    if ("error" in access) {
      return c.json(
        { error: access.error === "not-found" ? "Project not found." : "Only document editors can manage links." },
        access.error === "not-found" ? 404 : 403,
      );
    }
    const rows = await db
      .prepare(
        "SELECT token, permission, label, created_by, created_at, last_used_at FROM share_links WHERE project_id = ? ORDER BY created_at DESC",
      )
      .bind(projectId)
      .all();
    return c.json({ links: rows.results ?? [] });
  });

  // Revoke a share link. Must be an editor of the link's document.
  api.delete("/api/links/:token", async (c) => {
    const identity = await resolveIdentity(c.req.raw, c.env);
    if (!identity) return unauthorized(c);
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const token = c.req.param("token");
    const link = await db
      .prepare("SELECT project_id FROM share_links WHERE token = ?")
      .bind(token)
      .first<{ project_id: string }>();
    if (!link) return c.json({ error: "Link not found." }, 404);
    const access = await requireProjectAccess(db, link.project_id, identity.email);
    if ("error" in access) return c.json({ error: "Only document editors can revoke links." }, 403);
    await db.prepare("DELETE FROM share_links WHERE token = ?").bind(token).run();
    return c.json({ ok: true });
  });

  // Resolve a share token (public): what document + permission it grants.
  api.get("/api/links/:token/resolve", async (c) => {
    const db = c.env.DB;
    if (!db) return c.json({ error: "D1 database is not bound." }, 500);
    await ensureSchema(db);
    const token = c.req.param("token");
    const link = await db
      .prepare(
        `SELECT l.project_id, l.permission, l.label, p.title
         FROM share_links l LEFT JOIN projects p ON p.id = l.project_id
         WHERE l.token = ?`,
      )
      .bind(token)
      .first<{ project_id: string; permission: string; label: string; title: string | null }>();
    if (!link || (link.permission !== "reader" && link.permission !== "editor")) {
      return c.json({ error: "This link is invalid or was revoked." }, 404);
    }
    await db
      .prepare("UPDATE share_links SET last_used_at = datetime('now') WHERE token = ?")
      .bind(token)
      .run();
    const tabs = await db
      .prepare("SELECT tab_name, title, updated_at, updated_by FROM doc_meta WHERE project_id = ? ORDER BY tab_name ASC")
      .bind(link.project_id)
      .all();
    return c.json({
      projectId: link.project_id,
      title: link.title ?? link.project_id,
      permission: link.permission,
      label: link.label,
      tabs: (tabs.results ?? []).map((t) => {
        const row = t as { tab_name: string; title: string; updated_at: string; updated_by: string | null };
        return { name: row.tab_name, title: row.title, updatedAt: row.updated_at, updatedBy: row.updated_by };
      }),
    });
  });

  return api;
}
