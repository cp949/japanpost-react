import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

type DemoProxyEnv = {
  DEMO_API_PROXY_TARGET?: string;
  PORT?: string;
};

export function resolveDemoApiProxyTarget(env: DemoProxyEnv): string {
  const explicitTarget = env.DEMO_API_PROXY_TARGET?.trim();

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
      "@cp949/japanpost-react": path.resolve(
        __dirname,
        "../../packages/japanpost-react/src/index.ts",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
});
