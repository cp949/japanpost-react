/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
