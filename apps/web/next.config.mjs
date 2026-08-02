/** @type {import('next').NextConfig} */
export default {
  // Arbeidspakkene distribueres som TypeScript-kilde, ikke ferdigbygget.
  transpilePackages: ["@aafkstats/db", "@aafkstats/query", "@aafkstats/schema"],

  webpack(config) {
    // Pakkene bruker NodeNext-ESM, der relative importer må skrives «./x.js» selv om
    // filen heter «x.ts». Next sin bundler leter etter en faktisk .js-fil og finner
    // ingenting. extensionAlias lar den prøve .ts først.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },

  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
};
