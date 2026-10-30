import { createRemoteJWKSet, importX509, jwtVerify } from "jose";

export interface TeamIdentity {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  verified: boolean;
}

/**
 * HttpOnly cookie holding a Firebase **session cookie** (a long-lived,
 * signed token minted by the Firebase Admin API). It lets the server render
 * authenticated pages without waiting for the browser's Firebase SDK.
 */
export const SESSION_COOKIE = "leaf_session";

/**
 * Dev-mode fallback cookie. Set only when Firebase is not configured locally;
 * mirrors the `x-dev-user-email` header the client sends.
 */
export const DEV_EMAIL_COOKIE = "leaf_dev_email";

const JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
);

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) jwks = createRemoteJWKSet(JWKS_URL);
  return jwks;
}

function base64UrlDecode(segment: string): unknown {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded);
  return JSON.parse(json);
}

/** Parse a `Cookie:` header into a plain object. */
export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie");
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Verify a Firebase ID token (Google RS256) and return the caller identity.
 *
 * The expected Firebase project id is optional: when `expectedProjectId` is
 * set the token audience must match it, otherwise any Google-signed
 * securetoken is accepted and its `aud` is treated as the project. Set
 * FIREBASE_PROJECT_ID in the Worker environment to lock this down.
 */
export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId?: string,
): Promise<TeamIdentity | null> {
  try {
    const unverified = base64UrlDecode(token.split(".")[1] ?? "") as {
      aud?: string;
    };
    const aud = typeof unverified.aud === "string" ? unverified.aud : "";
    if (!aud) return null;
    if (expectedProjectId && aud !== expectedProjectId) return null;

    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `https://securetoken.google.com/${aud}`,
      audience: aud,
    });
    const email =
      typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email || typeof payload.sub !== "string") return null;
    return {
      uid: payload.sub,
      email,
      name:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name
          : email,
      picture:
        typeof payload.picture === "string" ? payload.picture : undefined,
      verified: true,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Firebase session cookies                                            */
/* ------------------------------------------------------------------ */

/**
 * Public keys used to sign Firebase **session cookies**. Session cookies are
 * signed by the Identity Toolkit key (not by `securetoken@system.gserviceaccount.com`
 * like ID tokens) and are published here as a `kid -> X.509 certificate` map.
 */
const SESSION_KEYS_URL =
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";

/** Issuer prefix of a Firebase session cookie. */
const SESSION_ISSUER_PREFIX = "https://session.firebase.google.com/";

let sessionCerts: { fetchedAt: number; map: Record<string, string> } | null = null;

/** Cached Identity Toolkit certificates (rotates rarely; 6h cache is ample). */
async function getSessionCerts(force = false): Promise<Record<string, string>> {
  const ttl = 6 * 60 * 60 * 1000;
  if (!force && sessionCerts && Date.now() - sessionCerts.fetchedAt < ttl) {
    return sessionCerts.map;
  }
  const res = await fetch(SESSION_KEYS_URL);
  if (!res.ok) throw new Error(`session keys fetch failed (${res.status})`);
  const map = (await res.json()) as Record<string, string>;
  sessionCerts = { fetchedAt: Date.now(), map };
  return map;
}

/** Build an identity from verified JWT claims. */
function identityFromClaims(claims: Record<string, unknown>): TeamIdentity | null {
  const email =
    typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (!email || !sub) return null;
  return {
    uid: sub,
    email,
    name:
      typeof claims.name === "string" && claims.name.trim()
        ? claims.name
        : email,
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
    verified: true,
  };
}

/**
 * Verify a Firebase **session cookie** and return the caller identity.
 *
 * A session cookie is *not* an ID token: its issuer is
 * `https://session.firebase.google.com/<project>` (ID tokens use
 * `https://securetoken.google.com/<project>`) and it is signed with the
 * Identity Toolkit key, so it must be checked against a different key set.
 *
 * Verification happens locally against Google's public certificate. If that
 * fails (unknown key id, X.509 import unsupported in the runtime) the cookie
 * is validated server-side by Firebase's Admin API instead.
 */
export async function verifyFirebaseSessionCookie(
  token: string,
  env: SessionCookieEnv,
): Promise<TeamIdentity | null> {
  const projectId = env.FIREBASE_PROJECT_ID;
  let claims: Record<string, unknown>;
  try {
    claims = base64UrlDecode(token.split(".")[1] ?? "") as Record<string, unknown>;
  } catch {
    return null;
  }

  const aud = typeof claims.aud === "string" ? claims.aud : "";
  const iss = typeof claims.iss === "string" ? claims.iss : "";
  if (!aud || !iss.startsWith(SESSION_ISSUER_PREFIX)) return null;
  if (projectId && aud !== projectId) return null;
  if (iss !== `${SESSION_ISSUER_PREFIX}${aud}`) return null;

  // 1. Local signature verification against Google's Identity Toolkit cert.
  try {
    const { payload } = await jwtVerify(
      token,
      async (protectedHeader) => {
        const kid = protectedHeader.kid ?? "";
        let map = await getSessionCerts();
        let pem = map[kid];
        if (!pem) {
          map = await getSessionCerts(true);
          pem = map[kid];
        }
        if (!pem) throw new Error("unknown session cookie key id");
        return importX509(pem, "RS256");
      },
      { issuer: `${SESSION_ISSUER_PREFIX}${aud}`, audience: aud },
    );
    const identity = identityFromClaims(payload as Record<string, unknown>);
    if (identity) return identity;
  } catch {
    // Fall through to the Admin API check below.
  }

  // 2. Fallback: let Firebase validate the cookie server-side.
  return verifySessionCookieViaAdmin(token, env);
}

/**
 * Validate a session cookie through Firebase's Admin REST API
 * (`projects.verifySessionCookie`). Used when local signature verification
 * is not possible.
 */
async function verifySessionCookieViaAdmin(
  token: string,
  env: SessionCookieEnv,
): Promise<TeamIdentity | null> {
  const projectId = env.FIREBASE_PROJECT_ID;
  const email = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !email || !privateKey) return null;
  try {
    const accessToken = await adminAccessToken(email, privateKey);
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}:verifySessionCookie`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionCookie: token }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      email?: string;
      sub?: string;
      uid?: string;
    };
    const mail = typeof data.email === "string" ? data.email.toLowerCase() : "";
    if (!mail) return null;
    return {
      uid: data.sub ?? data.uid ?? mail,
      email: mail,
      name: data.name ?? mail,
      verified: true,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the caller from a Bearer Firebase ID token, a Firebase session
 * cookie, or a dev fallback.
 *
 * Order of preference:
 *   1. `Authorization: Bearer <id token>` — the client SDK's token.
 *   2. `leaf_session` cookie — a Firebase session cookie, so server-rendered
 *      requests are authenticated without a round trip to the client.
 *   3. Dev fallback (`x-dev-user-email` header or `leaf_dev_email` cookie).
 *
 * The dev fallback is disabled when `requireAuth` is true; only verified
 * tokens are accepted then.
 */
export async function resolveIdentity(
  request: Request,
  env: SessionCookieEnv & { REQUIRE_AUTH?: string },
): Promise<TeamIdentity | null> {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const identity = await verifyFirebaseIdToken(
      auth.slice("Bearer ".length).trim(),
      env.FIREBASE_PROJECT_ID || undefined,
    );
    if (identity) return identity;
  }

  const cookies = parseCookies(request);
  const session = cookies[SESSION_COOKIE];
  if (session) {
    const identity = await verifyFirebaseSessionCookie(session, env);
    if (identity) return identity;
  }

  if (env.REQUIRE_AUTH === "1") return null;

  const devEmail = (
    request.headers.get("x-dev-user-email") ??
    cookies[DEV_EMAIL_COOKIE] ??
    ""
  ).trim().toLowerCase();
  if (!devEmail || !devEmail.includes("@")) return null;
  const devName = request.headers.get("x-dev-user-name")?.trim();
  return {
    uid: `dev:${devEmail}`,
    email: devEmail,
    name: devName || devEmail,
    verified: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Firebase session cookies (Admin API)                               */
/* ------------------------------------------------------------------ */

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cached service-account access token (valid for 1h; refreshed 10 min early). */
let cachedAdminToken: { email: string; token: string; expiresAt: number } | null = null;

/** Service-account access token with the identitytoolkit scope. */
async function adminAccessToken(email: string, privateKey: string): Promise<string> {
  if (
    cachedAdminToken &&
    cachedAdminToken.email === email &&
    Date.now() < cachedAdminToken.expiresAt
  ) {
    return cachedAdminToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/identitytoolkit",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${b64url(new Uint8Array(signature))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`admin token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("admin token exchange returned no token");
  cachedAdminToken = {
    email,
    token: data.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return data.access_token;
}

/** Turn a PEM (PKCS#8) private key into an ArrayBuffer the WebCrypto API accepts. */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface SessionCookieEnv {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}

/** Max Firebase session-cookie lifetime: 5 days. */
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

/**
 * Exchange a Firebase ID token for a session cookie using the Admin REST
 * API. Returns null when the service account is not configured (for example
 * local dev without Firebase) so callers can fall back to header auth.
 */
export async function createSessionCookie(
  idToken: string,
  env: SessionCookieEnv,
): Promise<string | null> {
  const projectId = env.FIREBASE_PROJECT_ID;
  const email = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !email || !privateKey) return null;

  const accessToken = await adminAccessToken(email, privateKey);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}:createSessionCookie`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ idToken, validDuration: SESSION_MAX_AGE_SECONDS }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`createSessionCookie failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { sessionCookie?: string };
  return data.sessionCookie ?? null;
}

