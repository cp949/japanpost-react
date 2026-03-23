import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cp949/japanpost-react": path.resolve(__dirname, "./src/index.ts"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "browser/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
