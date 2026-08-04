import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js løser «@/…» mot apps/web via tsconfig-paths. Vitest kjører utenfor
  // Next og trenger den samme opplysningen, ellers kan ingen test importere en
  // fil som selv bruker aliaset.
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "apps/web") },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
  },
});
