import { bindings, defineConfig, defineWorker, exports } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "leafy",
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
        worker: "leafy",
        exportName: "YjsRoom",
      }),
      // D1 database for users, projects, memberships, and invitations.
      // Create with `cf d1 create --name leaf-db`, then
      // `cf d1 migrations apply leaf-db`.
      DB: bindings.d1({ name: "leaf-db" }),
      // Plaintext vars (per owner request: plain, not secret). Values come
      // from the local `.env` at deploy time and are never committed.
      CLOUDFLARE_ACCOUNT_ID: bindings.text(process.env.CLOUDFLARE_ACCOUNT_ID ?? ""),
      CLOUDFLARE_API_TOKEN: bindings.text(process.env.CLOUDFLARE_API_TOKEN ?? ""),
      R2_ACCESS_KEY_ID: bindings.text(process.env.R2_ACCESS_KEY_ID ?? ""),
      R2_SECRET_ACCESS_KEY: bindings.text(process.env.R2_SECRET_ACCESS_KEY ?? ""),
      R2_S3_ENDPOINT: bindings.text(process.env.R2_S3_ENDPOINT ?? ""),
      // Firebase: project id locks invite/doc APIs to this Firebase project
      // (strict ID-token audience check). The NEXT_PUBLIC_* login keys ship
      // inside the app bundle at build time instead.
      FIREBASE_PROJECT_ID: bindings.text(process.env.FIREBASE_PROJECT_ID ?? ""),
      // Service account used by the Admin API to mint session cookies, so
      // server-rendered pages can authenticate without the browser SDK.
      FIREBASE_CLIENT_EMAIL: bindings.text(process.env.FIREBASE_CLIENT_EMAIL ?? ""),
      FIREBASE_PRIVATE_KEY: bindings.text(process.env.FIREBASE_PRIVATE_KEY ?? ""),
    },
  }),
});
