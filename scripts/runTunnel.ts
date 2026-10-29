/**
 * Start (or restart) the Cloudflare quick tunnel for local dev and sync
 * Firebase authorized domains: drop any stale *.trycloudflare.com entries,
 * add this tunnel's own hostname. The tunnel keeps running detached; the
 * script exits after Firebase is updated.
 *
 * Usage: bun run startTunnel
 */
import { spawn } from "node:child_process";
import { openSync, readFileSync, writeFileSync } from "node:fs";
import {
  findTunnelPids,
  listAuthorizedDomains,
  loadEnv,
  setAuthorizedDomains,
  sleep,
  stopPids,
  TUNNEL_LOG,
  TUNNEL_TARGET,
} from "./tunnelUtil";

async function main(): Promise<void> {
  // 1. Stop any tunnel already running (e.g. from an earlier session).
  const old = findTunnelPids();
  if (old.length > 0) {
    console.log(`Stopping old tunnel process(es): ${old.join(", ")}`);
    await stopPids(old);
  }

  // 2. Warn when the dev server is not up yet (tunnel 502s until it starts).
  try {
    const res = await fetch(TUNNEL_TARGET, { signal: AbortSignal.timeout(8000) });
    console.log(`Dev server is up (${res.status}).`);
  } catch {
    console.log(`WARNING: dev server not reachable at ${TUNNEL_TARGET} — start it with: bun run dev:vinext`);
  }

  // 3. Launch a fresh tunnel detached so it survives this script's exit.
  writeFileSync(TUNNEL_LOG, "");
  const logFd = openSync(TUNNEL_LOG, "a");
  const child = spawn("cloudflared", ["tunnel", "--url", TUNNEL_TARGET], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  console.log(`Tunnel started (pid ${child.pid}), logging to ${TUNNEL_LOG}.`);

  // 4. Wait for the public hostname in the log.
  const hostRe = /(https:\/\/[a-z0-9.-]+\.trycloudflare\.com)/;
  let url: string | null = null;
  const deadline = Date.now() + 90000;
  while (!url && Date.now() < deadline) {
    await sleep(2000);
    const log = readFileSync(TUNNEL_LOG, "utf8");
    const m = log.match(hostRe);
    if (m) url = m[1];
  }
  if (!url) throw new Error("Timed out waiting for the tunnel URL. See " + TUNNEL_LOG);
  const host = new URL(url).hostname;
  console.log(`Tunnel URL: ${url}`);

  // 5. Firebase: drop stale trycloudflare entries, add this tunnel's host.
  const env = loadEnv();
  const current = await listAuthorizedDomains(env);
  const kept = current.filter((d) => !d.endsWith(".trycloudflare.com"));
  const removed = current.filter((d) => d.endsWith(".trycloudflare.com"));
  const next = kept.includes(host) ? kept : [...kept, host];
  await setAuthorizedDomains(env, next);
  for (const d of removed) console.log(`Removed stale domain: ${d}`);
  console.log(`Authorized domains now include: ${host}`);
}

main().catch((err) => {
  console.error(`startTunnel failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
