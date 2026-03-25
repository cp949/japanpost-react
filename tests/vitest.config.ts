import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cp949/japanpost-react": path.resolve(
        __dirname,
        "../packages/japanpost-react/src/index.ts",
      ),
      "@cp949/japanpost-react/client": path.resolve(
        __dirname,
        "../packages/japanpost-react/src/client.ts",
      ),
    },
  },
  test: {
    // Keep the root workspace suite node-first and lightweight.
    // The remaining browser-style demo flow test stays in the package suite
    // so it can reuse the package-local jsdom/testing-library harness.
    environment: "node",
    globals: true,
    include: ["tests/workspace/**/*.test.ts"],
  },
});
