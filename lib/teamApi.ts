'use client';

import type { AuthUser } from "./AuthContext";

export interface Invite {
  id: string;
  project_id: string;
  project_title: string;
  inviter_email?: string;
  invitee_email?: string;
  status: string;
  created_at: string;
}

export interface ProjectMember {
  email: string;
  role: string;
  added_at: string;
}

const DEV_EMAIL_KEY = "leaf-dev-email";

// Share-link credential for `/s/:token` visitors (no account needed). Sent as
// `x-share-token` alongside — or instead of — the Firebase bearer token.
let shareToken: string | null = null;

export function setShareToken(token: string | null) {
  shareToken = token && token.trim() ? token.trim() : null;
}

export function getShareToken(): string | null {
  return shareToken;
}

export function getDevEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DEV_EMAIL_KEY) ?? "";
}

export function setDevEmail(email: string) {
  if (typeof window === "undefined") return;
  if (email.trim()) window.localStorage.setItem(DEV_EMAIL_KEY, email.trim().toLowerCase());
  else window.localStorage.removeItem(DEV_EMAIL_KEY);
}

async function authHeaders(user: AuthUser | null): Promise<HeadersInit> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = await user?.getIdToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  } else {
    const devEmail = getDevEmail();
    if (devEmail) {
      headers["x-dev-user-email"] = devEmail;
      if (user?.name) headers["x-dev-user-name"] = user.name;
    }
  }
  if (shareToken) headers["x-share-token"] = shareToken;
  return headers;
}

async function request<T>(path: string, user: AuthUser | null, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(await authHeaders(user)), ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Request failed (${res.status}).`,
    );
  }
  return data as T;
}

export async function ensureProject(user: AuthUser | null, id: string, title: string) {
  return request<{ project: { id: string; title: string; ownerEmail: string; role: string } }>(
    "/api/projects/ensure",
    user,
    { method: "POST", body: JSON.stringify({ id, title }) },
  );
}

export async function fetchMembers(user: AuthUser | null, projectId: string) {
  return request<{
    project: { id: string; title: string; ownerEmail: string };
    members: ProjectMember[];
    pending: { id: string; invitee_email: string; status: string; created_at: string }[];
    myRole: string;
  }>(`/api/projects/${encodeURIComponent(projectId)}/members`, user);
}

export async function sendInvite(
  user: AuthUser | null,
  projectId: string,
  projectTitle: string,
  inviteeEmail: string,
) {
  return request<{ invite: { id: string } }>("/api/invites", user, {
    method: "POST",
    body: JSON.stringify({ projectId, projectTitle, inviteeEmail }),
  });
}

export async function fetchInbox(user: AuthUser | null): Promise<{ invites: Invite[] }> {
  return request("/api/invites/inbox?status=pending", user);
}

export async function acceptInvite(user: AuthUser | null, id: string) {
  return request<{ ok: boolean; projectId: string }>(`/api/invites/${encodeURIComponent(id)}/accept`, user, {
    method: "POST",
  });
}

export async function rejectInvite(user: AuthUser | null, id: string) {
  return request<{ ok: boolean }>(`/api/invites/${encodeURIComponent(id)}/reject`, user, {
    method: "POST",
  });
}

export interface DocSnapshot {
  title: string;
  tab: string;
  savedAt: string;
  savedBy: string;
  format: "yjs-gzip-b64-v1";
}

/** Save one document tab: compressed Yjs state + JSON envelope. */
export async function saveDocTab(
  user: AuthUser | null,
  projectId: string,
  tab: string,
  title: string,
  stateB64: string,
  snapshot: DocSnapshot,
) {
  return request<{ ok: boolean; chunks: number; bytes: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/doc`,
    user,
    {
      method: "PUT",
      body: JSON.stringify({ tab, title, stateB64, snapshot }),
    },
  );
}

export type LoadedDocTab =
  | { empty: true }
  | {
      title: string;
      snapshot: Record<string, unknown>;
      stateB64: string;
      chunkCount: number;
      bytes: number;
      updatedAt: string;
      updatedBy: string | null;
    };

export interface ShareLink {
  token: string;
  permission: "reader" | "editor";
  label: string;
  projectId?: string;
  created_by?: string | null;
  created_at?: string;
  last_used_at?: string | null;
}

export interface ResolvedShareLink {
  projectId: string;
  title: string;
  permission: "reader" | "editor";
  label: string;
  tabs: { name: string; title: string; updatedAt: string; updatedBy: string | null }[];
}

/** Create a share link with reader or editor permission. Editors only. */
export async function createShareLink(
  user: AuthUser | null,
  projectId: string,
  permission: "reader" | "editor",
  label: string,
) {
  return request<{ link: ShareLink }>(`/api/projects/${encodeURIComponent(projectId)}/links`, user, {
    method: "POST",
    body: JSON.stringify({ permission, label }),
  });
}

/** List a document's share links. Editors only. */
export async function listShareLinks(user: AuthUser | null, projectId: string) {
  return request<{ links: ShareLink[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/links`,
    user,
  );
}

/** Revoke a share link. Editors only. */
export async function revokeShareLink(user: AuthUser | null, token: string) {
  return request<{ ok: boolean }>(`/api/links/${encodeURIComponent(token)}`, user, {
    method: "DELETE",
  });
}

/** Resolve a share token (public): document, permission, and saved tabs. */
export async function resolveShareLink(token: string): Promise<ResolvedShareLink> {
  const res = await fetch(`/api/links/${encodeURIComponent(token)}/resolve`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: unknown };
    throw new Error(typeof err.error === "string" ? err.error : "This link is invalid or was revoked.");
  }
  return data as ResolvedShareLink;
}

/** Load one document tab. Returns `{empty:true}` when never saved. */
export async function loadDocTab(
  user: AuthUser | null,
  projectId: string,
  tab: string,
): Promise<LoadedDocTab | null> {
  try {
    return await request<LoadedDocTab>(
      `/api/projects/${encodeURIComponent(projectId)}/doc?tab=${encodeURIComponent(tab)}`,
      user,
    );
  } catch {
    return null;
  }
}
