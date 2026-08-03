import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Genererte og hentede filer. Uten dette bruker ESLint mesteparten av tiden
    // sin på .next/ og dist/. `next-env.d.ts` skrives av Next ved hvert bygg, så
    // en rettelse der blir overskrevet uansett.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.data/**",
      "**/.cache/**",
      "apps/web/next-env.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Ubrukte variabler er som regel en glipp, men «_» foran navnet er den
      // vanlige måten å si at noe er bevisst ubrukt.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Vi har allerede `strict` i TypeScript. Denne regelen tar bare `any` som
      // kommer inn utenfra — den er nyttig som advarsel, ikke som byggestopper.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  {
    // Node-globaler i CLI-er, byggesteg og tester. Flat config har ingen
    // «env»-nøkkel, så de listes her.
    files: ["**/*.{ts,tsx,mjs,js}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        ReadableStream: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "writable",
      },
    },
  },

  {
    // React-komponenter i Next. JSX-typene kommer fra tsconfig, ikke herfra —
    // ESLint trenger bare å slutte å klage på at `React` ikke er importert.
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { React: "readonly" },
    },
  },
);
