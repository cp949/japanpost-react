import { defineConfig, type Options } from "tsup";

import { loadBaseline } from "./scripts/baseline.mjs";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// 배포 산출물의 문법 하한이다.
// 정본은 package.json#browserslist이고 scripts/baseline.mjs가 파생한다.
// scripts/check-browser-compat.mjs가 같은 파생값으로 산출물을 검사한다.
const target = loadBaseline(import.meta.dirname)
  .esbuildTarget as Options["target"];

// node 전역을 차단한 빌드 전용 타입 경계다.
const tsconfig = "tsconfig.src.json";

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
    target,
    treeshake: true,
    tsconfig,
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
    target,
    treeshake: true,
    tsconfig,
  },
]);
