import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@cp949/japanpost-react/client",
        replacement: path.resolve(__dirname, "./src/client.ts"),
      },
      {
        find: "@cp949/japanpost-react",
        replacement: path.resolve(__dirname, "./src/index.ts"),
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
