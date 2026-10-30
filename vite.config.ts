import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { fileURLToPath } from "node:url";

/**
 * Paged.js' prebuilt browser bundle.
 *
 * See next.config.ts: the package's ESM sources pull in `es5-ext`, whose
 * `String.prototype.contains` shim has a circular dependency that breaks
 * when it is bundled module-by-module ("contains.call is not a function").
 * The prebuilt bundle has that graph already resolved by Rollup.
 *
 * The path is absolute on purpose: the package's `exports` map does not
 * expose `dist/paged.js` as a subpath, so a package-style specifier would be
 * rejected by the resolver.
 */
const pagedjsBundle = fileURLToPath(
  new URL("./node_modules/pagedjs/dist/paged.js", import.meta.url),
);

export default defineConfig({
  // Allow Cloudflare quick-tunnel hostnames (they rotate every run).
  server: { allowedHosts: true },
  resolve: {
    alias: {
      pagedjs: pagedjsBundle,
    },
  },
  plugins: [
    vinext({
      prerender: { routes: "*" },
      images: { imagesOptimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
