/** 브라우저 지원 계약의 정본에서 파생한 값 묶음이다. */
export interface BrowserBaseline {
  /** package.json#browserslist 원문. 계약의 정본이다. */
  query: string[];
  /** 질의에서 파생한 Chrome 하한. 런타임 API 게이트의 기준이다. */
  minChrome: number;
  /** 질의에서 파생한 esbuild 타깃. 빌드와 문법 게이트가 공유한다. */
  esbuildTarget: string[];
}

/**
 * packageDir의 package.json에서 browserslist 질의를 읽어 파생값을 만든다.
 * 질의가 없거나 Chrome 하한을 구할 수 없으면 던진다.
 */
export function loadBaseline(packageDir: string): BrowserBaseline;
