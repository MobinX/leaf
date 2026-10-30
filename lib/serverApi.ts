/**
 * Server-side helpers for authenticated data fetching during rendering.
 *
 * The app is served by one Worker that also hosts the `/api/*` routes, so a
 * Server Component can call its own API with the visitor's session cookie.
 * That is what makes the home page and the editor render with real data on
 * the first request instead of waiting for the browser's Firebase SDK.
 */
import { cookies, headers } from "next/headers";
import type { ServerDocument, ServerDocTab } from "./documentTypes";

export const SESSION_COOKIE = "leaf_session";

/** Raw `Cookie:` header for the current request (empty when unauthenticated). */
export async function getRequestCookieHeader(): Promise<string> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return "";
  return all
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

/** The session cookie value, if the visitor has one. */
export async function getSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Origin of the current request, so a server-side fetch reaches the same
 * deployment that is serving the page.
 */
export async function getRequestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return "http://localhost:3001";
  const proto =
    list.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export type { ServerDocument, ServerDocTab } from "./documentTypes";

/**
 * GET a JSON API route with the visitor's cookies attached. Returns null on
 * any failure so a rendering error never takes the page down.
 */
async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const origin = await getRequestOrigin();
    const cookie = await getRequestCookieHeader();
    const res = await fetch(`${origin}${path}`, {
      headers: cookie ? { cookie } : undefined,
      // Never cache: the response depends on the session cookie.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Every document the visitor can open.
 *
 * Returns `authenticated: false` when the server could not identify the
 * visitor (signed out) — the client then falls back to the local list and
 * keeps showing its own loading state.
 */
export async function fetchServerDocuments(): Promise<{
  documents: ServerDocument[];
  authenticated: boolean;
}> {
  const origin = await getRequestOrigin();
  const cookie = await getRequestCookieHeader();
  try {
    const res = await fetch(`${origin}/api/documents`, {
      headers: cookie ? { cookie } : undefined,
      // Never cache: the response depends on the session cookie.
      cache: "no-store",
    });
    if (res.status === 401) return { documents: [], authenticated: false };
    if (!res.ok) return { documents: [], authenticated: false };
    const data = (await res.json()) as { documents?: ServerDocument[] };
    return { documents: data.documents ?? [], authenticated: true };
  } catch {
    return { documents: [], authenticated: false };
  }
}

/** All saved tabs of one document, with their compressed Yjs state. */
export async function fetchServerSnapshot(
  projectId: string,
): Promise<ServerDocTab[]> {
  const data = await serverGet<{ tabs?: ServerDocTab[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/snapshot`,
  );
  return data?.tabs ?? [];
}
