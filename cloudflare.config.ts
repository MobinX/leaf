import { bindings, defineConfig, defineWorker, exports } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "my-app",
    entrypoint: "./worker/entry.ts",
    compatibilityDate: "2026-10-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    exports: {
      YjsRoom: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Self-binding: the `YjsRoom` class is exported by this same Worker
      // (see `worker/entry.ts`), so the worker name refers to itself.
      YJS_ROOMS: bindings.durableObject({
        worker: "my-app",
        exportName: "YjsRoom",
      }),
      // D1 database for users, projects, memberships, and invitations.
      // Create with `cf d1 create --name leaf-db`, then
      // `cf d1 migrations apply leaf-db`.
      DB: bindings.d1({ name: "leaf-db" }),
    },
  }),
});
