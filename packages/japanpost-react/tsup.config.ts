import { defineConfig } from "tsup";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// 배포 산출물의 문법 하한이다. Chrome 80 지원 계약의 근거이며
// scripts/check-browser-compat.mjs가 같은 값으로 산출물을 검사한다.
const target = "es2019";

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
