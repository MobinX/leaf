/**
 * Shared helpers for the tunnel scripts: .env loading, tunnel process
 * discovery, and Firebase authorized-domains management (admin key from .env).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TUNNEL_TARGET = "http://localhost:3001";
export const TUNNEL_LOG = "/tmp/leaf-tunnel.log";

/** Minimal dotenv parse (handles double quotes + \n escapes). */
export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(join(REPO_ROOT, ".env"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);
    env[m[1]] = v.replace(/\\n/g, "\n");
  }
  return env;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function adminAccessToken(email: string, privateKey: string): Promise<string> {
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
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(privateKey))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`admin token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("admin token exchange returned no token");
  return data.access_token;
}

async function authed(env: Record<string, string>, path: string, init?: RequestInit) {
  const token = await adminAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
  const project = env.FIREBASE_PROJECT_ID;
  const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

/** Current authorized domains for the Firebase project. */
export async function listAuthorizedDomains(env: Record<string, string>): Promise<string[]> {
  const { status, data } = await authed(env, "/config");
  if (status !== 200) throw new Error(`read authorized domains failed (${status})`);
  return Array.isArray(data.authorizedDomains) ? (data.authorizedDomains as string[]) : [];
}

/** Replace the full authorized-domains list. */
export async function setAuthorizedDomains(
  env: Record<string, string>,
  domains: string[],
): Promise<void> {
  const { status, data } = await authed(env, "/config?updateMask=authorizedDomains", {
    method: "PATCH",
    body: JSON.stringify({ authorizedDomains: domains }),
  });
  if (status !== 200) throw new Error(`update authorized domains failed (${status}): ${JSON.stringify(data).slice(0, 200)}`);
}

/**
 * PIDs of running `cloudflared tunnel` processes. Only matches processes
 * whose executable is actually cloudflared, and never the caller or any of
 * its ancestors (a shell invoking this script contains the same words in its
 * own command line, and must not be killed).
 */
export function findTunnelPids(): number[] {
  // Ancestor chain of this process (self included) — never touch these.
  const protectedPids = new Set<number>([process.pid]);
  try {
    let pid = process.pid;
    for (let i = 0; i < 64; i++) {
      const ppid = Number(execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf8" }).trim());
      if (!ppid || protectedPids.has(ppid)) break;
      protectedPids.add(ppid);
      pid = ppid;
    }
  } catch {
    // Fall back to self-only protection.
  }

  let out = "";
  try {
    out = execSync("ps -eo pid,comm,args", { encoding: "utf8" });
  } catch {
    return [];
  }
  const pids: number[] = [];
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    if (protectedPids.has(pid)) continue;
    if (m[2] === "cloudflared" && m[3].includes("tunnel")) pids.push(pid);
  }
  return pids;
}

/** SIGTERM, wait, then SIGKILL survivors. Returns once none remain. */
export async function stopPids(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
  const deadline = Date.now() + 8000;
  let remaining = pids;
  while (remaining.length > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    remaining = remaining.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
  }
  for (const pid of remaining) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
