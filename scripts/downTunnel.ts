/**
 * Stop the running Cloudflare tunnel and remove any *.trycloudflare.com
 * entries from Firebase authorized domains (stable domains are kept).
 *
 * Usage: bun run stopTunnel
 */
import {
  findTunnelPids,
  listAuthorizedDomains,
  loadEnv,
  setAuthorizedDomains,
  stopPids,
} from "./tunnelUtil";

async function main(): Promise<void> {
  const pids = findTunnelPids();
  if (pids.length === 0) {
    console.log("No running tunnel found.");
  } else {
    console.log(`Stopping tunnel process(es): ${pids.join(", ")}`);
    await stopPids(pids);
    console.log("Tunnel stopped.");
  }

  const env = loadEnv();
  const current = await listAuthorizedDomains(env);
  const stale = current.filter((d) => d.endsWith(".trycloudflare.com"));
  if (stale.length === 0) {
    console.log("No trycloudflare domains in Firebase.");
    return;
  }
  await setAuthorizedDomains(
    env,
    current.filter((d) => !d.endsWith(".trycloudflare.com")),
  );
  for (const d of stale) console.log(`Removed domain: ${d}`);
  console.log("Firebase authorized domains cleaned.");
}

main().catch((err) => {
  console.error(`stopTunnel failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
