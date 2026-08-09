/**
 * Innholdspolicyen.
 *
 * Nettstedet henter ingenting utenfra: ingen skript, fonter eller bilder fra
 * andre verter, og eneste utgående kall er til våre egne API-ruter. Da kan
 * policyen være så stram som den er her. Eneste mulige unntak er en
 * Plausible-kompatibel teller, som er av med mindre noen slår den på — se
 * `externalAnalyticsOrigin()` under.
 *
 * `'unsafe-inline'` på script-src er unntaket, og den er Next sin: rammeverket
 * legger inn hydreringsdata som innebygde skript uten nonce, og en nonce ville
 * krevd middleware på hver forespørsel. Policyen stopper derfor ikke innsatt
 * skript i seg selv — den stopper at et slikt skript får sendt noe ut,
 * lastet noe inn, eller at siden rammes inn av andre. Det er verdt å ha selv om
 * det øverste laget mangler.
 */

/**
 * Verten til en eventuell Plausible-kompatibel teller, eller null.
 *
 * Vercel Web Analytics og Speed Insights leveres fra vårt eget domene og dekkes
 * av `'self'`. En teller ved siden av gjør det ikke, og uten et unntak her ville
 * skriptet blitt blokkert av policyen uten at noe annet sa fra — målingen ville
 * bare vært stille borte. Unntaket gjelder nøyaktig den verten som er
 * konfigurert, og finnes ikke når målingen er av (som den er som standard).
 *
 * Se `apps/web/lib/analytics.ts` for hva som faktisk sendes.
 */
function externalAnalyticsOrigin() {
  if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return null;
  try {
    const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";
    return new URL(src).origin;
  } catch {
    return null;
  }
}

const analyticsOrigin = externalAnalyticsOrigin();
const extra = analyticsOrigin ? ` ${analyticsOrigin}` : "";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${extra}`,
  // Next trenger foreløpig innebygde <script>-elementer, men ikke onload= og
  // andre skripthandlere i HTML-attributter. Skill dem, så en framtidig
  // HTML-injeksjon ikke automatisk blir kjørbar kode.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${extra}`,
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
export default {
  // Ingen grunn til å fortelle hvert svar hvilket rammeverk som står bak.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Ingen MIME-gjetting. Et svar som sier JSON skal ikke kunne kjøres som skript.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors dekker det samme for nyere nettlesere; denne er for de eldre.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Arkivet trenger ingen av disse. Da skal de heller ikke kunne spørres om.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },

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
