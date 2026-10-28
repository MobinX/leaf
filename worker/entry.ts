import { Hono } from "hono";
import { YDurableObjects, yRoute } from "y-durableobjects";
import vinextEntry from "vinext/server/fetch-handler";
import { teamRoutes } from "./teamApi";

/**
 * Bindings available to this Worker. `ASSETS` / `IMAGES` come from
 * `cloudflare.config.ts`; `YJS_ROOMS` is the Durable Object namespace backing
 * real-time collaboration (one DO instance per document room); `DB` is the
 * D1 database holding users, projects, memberships, and invitations.
 */
export interface CollabBindings {
  YJS_ROOMS: DurableObjectNamespace<YjsRoom>;
  ASSETS: Fetcher;
  IMAGES: unknown;
  DB: D1Database;
  FIREBASE_PROJECT_ID?: string;
  REQUIRE_AUTH?: string;
}

export type CollabEnv = {
  Bindings: CollabBindings;
};

/**
 * Collaboration sub-app. Mounted under `/collab`:
 *
 * - `GET /collab/health` — plain HTTPS health check for the collab service.
 * - `GET /collab/rooms/:id` — WebSocket upgrade (wss) speaking the
 *   y-websocket protocol, served by the `YjsRoom` Durable Object with
 *   WebSocket hibernation + SQLite persistence.
 *
 * The y-websocket client builds its URL as `<serverUrl>/<room>`, so the
 * editor connects with serverUrl `<origin>/collab/rooms`.
 */
const collab = new Hono<CollabEnv>();

collab.get("/collab/health", (c) => c.json({ ok: true, service: "yjs-collab" }));

collab.route(
  "/collab/rooms",
  // `yRoute` types its selector as returning a bare namespace; the runtime
  // object is the typed `YJS_ROOMS` binding.
  yRoute<CollabEnv>((env) => env.YJS_ROOMS as unknown as DurableObjectNamespace),
);

type VinextFetchHandler = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
  ) => Promise<Response> | Response;
};

function forwardToVinext(
  request: Request,
  env: CollabBindings,
  ctx: ExecutionContext,
): Promise<Response> | Response {
  const entry = vinextEntry as unknown;
  if (typeof entry === "function") {
    return (entry as VinextFetchHandler["fetch"])(request, env, ctx);
  }
  return (entry as VinextFetchHandler).fetch(request, env, ctx);
}

const team = teamRoutes();

export default {
  async fetch(
    request: Request,
    env: CollabBindings,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/collab/health" || pathname.startsWith("/collab/rooms/")) {
      return collab.fetch(request, env, ctx);
    }
    if (pathname.startsWith("/api/")) {
      return team.fetch(request, env, ctx);
    }
    return forwardToVinext(request, env, ctx);
  },
} satisfies ExportedHandler<CollabBindings>;

/**
 * One instance per document room (via `idFromName(room)`). Sync protocol,
 * awareness (cursors/presence), hibernating WebSockets, and SQLite-backed
 * document persistence all come from `y-durableobjects`.
 */
export class YjsRoom extends YDurableObjects<CollabEnv> {}
