import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// ESM 설정 파일에는 __dirname이 없다.
// Vite 8의 native config loader에서도 동작하도록 import.meta.url로 현재 디렉터리를 구한다.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@cp949/japanpost-react/client",
        replacement: path.resolve(currentDir, "./src/client.ts"),
      },
      {
        find: "@cp949/japanpost-react",
        replacement: path.resolve(currentDir, "./src/index.ts"),
      },
    ],
  },
  test: {
    exclude: [...configDefaults.exclude, "browser/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
