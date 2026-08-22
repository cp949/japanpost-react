import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Options } from "tsup";

import { loadBaseline } from "@repo/browser-baseline";

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// 자기 위치는 import.meta.url에서 구한다.
// tsup는 이 설정을 bundle-require로 번들해 실행하는데,
// bundle-require의 injectFileScopePlugin이 원본 소스마다 import.meta.url을
// 그 원본의 경로로 주입한다. import.meta.dirname은 주입 대상이 아니라서,
// 쓰면 번들 파일이 원본 옆에 쓰인다는 기본 출력 규칙에만 기대게 된다.
const packageDir = path.dirname(fileURLToPath(import.meta.url));

// 배포 산출물의 문법 하한이다.
// 정본은 package.json#browserslist이고 @repo/browser-baseline이 파생한다.
// browser-baseline CLI가 같은 파생값으로 산출물을 검사한다.
const target = loadBaseline(packageDir).esbuildTarget as Options["target"];

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
