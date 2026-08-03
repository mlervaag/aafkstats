/** @type {import('next').NextConfig} */
export default {
  // Arbeidspakkene distribueres som TypeScript-kilde, ikke ferdigbygget.
  transpilePackages: ["@aafkstats/db", "@aafkstats/query", "@aafkstats/schema"],

  webpack(config, { isServer }) {
    if (isServer) {
      // `node:sqlite` er eksperimentell i Node 22 og står ikke i Nodes
      // `builtinModules`. Webpack kjenner den derfor ikke igjen som innebygd og
      // prøver å bunte den — også når den hentes via createRequire, som webpack
      // analyserer og skriver om. Resultatet er en tom modul, og oppslaget feiler
      // først ved kjøring. Her sier vi eksplisitt at den skal kreves fra Node.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]).filter(
          Boolean,
        ),
        { "node:sqlite": "commonjs node:sqlite" },
      ];
    }

    // Pakkene bruker NodeNext-ESM, der relative importer må skrives «./x.js» selv om
    // filen heter «x.ts». Next sin bundler leter etter en faktisk .js-fil og finner
    // ingenting. extensionAlias lar den prøve .ts først.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },

  // Arkivfilen leses av serverkoden ved kjøring. Uten dette sporer ikke Next den
  // inn i funksjonsbunten, og den finnes ikke i produksjon.
  outputFileTracingIncludes: {
    "/**": [".data/aafkstats.sqlite"],
  },

  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
};
