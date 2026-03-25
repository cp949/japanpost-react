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
    alias: {
      // 배포 패키지 대신 워크스페이스 소스를 직접 바라보게 해서
      // 데모에서 라이브러리 최신 변경분을 즉시 확인할 수 있게 한다.
      "@cp949/japanpost-react": path.resolve(
        __dirname,
        "../../packages/japanpost-react/src/index.ts",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
});
