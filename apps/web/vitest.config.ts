import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/auth/**/*.test.ts"],
    setupFiles: ["tests/auth/setup.ts"],
    // bcrypt cost-12 actions take seconds; the lockout suite runs several.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
