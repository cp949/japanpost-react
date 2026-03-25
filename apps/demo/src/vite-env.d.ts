/// <reference types="vite/client" />

// Vite 환경 변수 중 데모 앱이 실제로 읽는 키만 명시해서
// `import.meta.env` 접근 시 타입 안전성을 확보한다.
interface ImportMetaEnv {
  readonly VITE_DEMO_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
