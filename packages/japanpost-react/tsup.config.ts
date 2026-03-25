import { defineConfig } from "tsup";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: {
      index: "src/index.ts",
    },
    external,
    format: ["esm"],
    outDir: "dist",
    outExtension() {
      return {
        js: ".es.js",
      };
    },
    sourcemap: false,
    splitting: false,
    treeshake: true,
  },
  {
    clean: false,
    dts: true,
    entry: {
      client: "src/client.ts",
    },
    external,
    format: ["esm"],
    outDir: "dist",
    outExtension() {
      return {
        js: ".es.js",
      };
    },
    sourcemap: false,
    splitting: false,
    treeshake: true,
  },
]);
