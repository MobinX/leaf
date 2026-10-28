import { createRemoteJWKSet, jwtVerify } from "jose";

export interface TeamIdentity {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  verified: boolean;
}

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

/**
 * Resolve the caller from a Bearer Firebase ID token, with a dev fallback.
 *
 * Local development without Firebase configured sends `x-dev-user-email`
 * (+ optional `x-dev-user-name`). When `requireAuth` is true the fallback is
 * disabled and only verified tokens are accepted.
 */
export async function resolveIdentity(
  request: Request,
  env: { FIREBASE_PROJECT_ID?: string; REQUIRE_AUTH?: string },
): Promise<TeamIdentity | null> {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const identity = await verifyFirebaseIdToken(
      auth.slice("Bearer ".length).trim(),
      env.FIREBASE_PROJECT_ID || undefined,
    );
    if (identity) return identity;
  }
  if (env.REQUIRE_AUTH === "1") return null;
  const devEmail = request.headers.get("x-dev-user-email")?.trim().toLowerCase();
  if (!devEmail || !devEmail.includes("@")) return null;
  const devName = request.headers.get("x-dev-user-name")?.trim();
  return {
    uid: `dev:${devEmail}`,
    email: devEmail,
    name: devName || devEmail,
    verified: false,
  };
}
