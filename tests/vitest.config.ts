import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// ESM 설정 파일에는 __dirname이 없다.
// Vite 8의 native config loader에서도 동작하도록 import.meta.url로 현재 디렉터리를 구한다.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@cp949/japanpost-react": path.resolve(
        currentDir,
        "../packages/japanpost-react/src/index.ts",
      ),
      "@cp949/japanpost-react/client": path.resolve(
        currentDir,
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
