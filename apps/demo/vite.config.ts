import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

type DemoProxyEnv = {
  DEMO_API_PROXY_URL?: string;
  PORT?: string;
};

export function resolveDemoApiProxyTarget(env: DemoProxyEnv): string {
  // 환경 변수로 명시한 프록시 대상이 있으면 그 값을 우선 사용하고,
  // 없으면 이 저장소의 기본 데모 서버 포트를 기준으로 로컬 주소를 만든다.
  const explicitTarget = env.DEMO_API_PROXY_URL?.trim();

  if (explicitTarget) {
    return explicitTarget;
  }

  const port = env.PORT?.trim() || "8788";
  return `http://127.0.0.1:${port}`;
}

export const demoWorkspaceAliases = [
  {
    find: "@cp949/japanpost-react/client",
    replacement: path.resolve(
      __dirname,
      "../../packages/japanpost-react/src/client.ts",
    ),
  },
  {
    find: "@cp949/japanpost-react",
    replacement: path.resolve(
      __dirname,
      "../../packages/japanpost-react/src/index.ts",
    ),
  },
];

export default defineConfig({
  plugins: [react()],
  server: {
    // demo 개발 중 `/minimal-api` 경로를 로컬 연동 서버로 연결한다.
    // 이 저장소의 지원 모델은 실제 서버 연동이며, 아래 설정은 개발 편의용이다.
    proxy: {
      "/minimal-api": {
        target: resolveDemoApiProxyTarget(process.env),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/minimal-api/, ""),
      },
    },
  },
  resolve: {
    // 더 구체적인 subpath alias를 루트 alias보다 앞에 두어
    // Vite/Rolldown이 `@cp949/japanpost-react/client`를 루트 prefix로 잘못 해석하지 않게 한다.
    alias: demoWorkspaceAliases,
    dedupe: ["react", "react-dom"],
  },
});
