import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Unit tests exercise pure logic; integration tests that need Postgres or a
    // live provider are skipped unless their env vars are present.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "scraper/src/**"],
      exclude: ["**/types/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@workers": fileURLToPath(new URL("./workers", import.meta.url)),
      // `server-only` throws when imported outside React Server Components.
      // Unit tests import service modules for their pure helpers, so we stub it.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
