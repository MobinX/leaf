import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  turbopack: {
    resolveAlias: {
      // Paged.js' ESM sources pull in `es5-ext`, whose `String.prototype.contains`
      // shim has a circular dependency that breaks when it is bundled
      // module-by-module ("contains.call is not a function"). The prebuilt
      // browser bundle has that graph already resolved by Rollup, so the
      // exporter uses it instead.
      pagedjs: "./node_modules/pagedjs/dist/paged.js",
    },
  },
  /* config options here */
};

export default nextConfig;
