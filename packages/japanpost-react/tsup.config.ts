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

// 소스맵은 browser-baseline 게이트가 쓴다.
// 게이트는 위반을 "dist/index.es.js:412"로만 짚을 수 있어서, 원인이 된 원본
// 파일(예: src/react/useJapanPostalCode.ts)을 함께 내려면 맵의 mappings가 있어야
// 한다. 맵 파일은 package.json#files의 부정 패턴으로 배포에서 빠지므로,
// 이 설정은 저장소 안 검사에만 쓰이고 배포 표면을 키우지 않는다.

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
    sourcemap: true,
    splitting: false,
    target,
    treeshake: true,
    tsconfig,
  },
  {
    // "use client" 지시문은 여기 banner로 넣지 않는다.
    // tsup은 banner를 esbuild에만 넘기고, treeshake: true면 그 출력에 rollup을
    // 한 번 더 돌린다. rollup은 module 최상위 지시문을 제거하므로
    // ("Module level directives cause errors when bundled" 경고) banner가
    // 산출물에 남지 않는다 — 실측으로 확인했다. 그래서 지시문은 빌드 후
    // scripts/postbuild.mjs가 붙이고, 같은 곳에서 소스맵 좌표를 보정한다.
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
    sourcemap: true,
    splitting: false,
    target,
    treeshake: true,
    tsconfig,
  },
]);
