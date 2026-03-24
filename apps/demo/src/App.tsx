/// <reference types="vite/client" />

import { useMemo, useState } from "react";
import { useJapanAddress } from "@cp949/japanpost-react";
import { DemoHeroSection } from "./DemoHeroSection";
import { DemoResultsPanel } from "./DemoResultsPanel";
import { DemoSearchPanel } from "./DemoSearchPanel";
import { demoPageStyle, demoPanelStyle } from "./demoStyles";
import {
  createDemoApiDataSource,
  DEFAULT_DEMO_API_BASE_URL,
  normalizeBaseUrl,
} from "./demoApi";
import { useDemoApiHealth } from "./useDemoApiHealth";

/**
 * 데모 앱 루트 컴포넌트다.
 * 라이브러리 훅, demo API data source, health 체크 UI를 한 화면에 조합해
 * 검색 동작과 readiness 계약을 함께 확인할 수 있게 한다.
 */
const DEFAULT_POSTAL_CODE = "102-0072";
const DEFAULT_KEYWORD = "千代田";

export default function App() {
  // env 값이 어떤 형태로 오더라도 fetch 경로 조합 규칙을 단순화한다.
  const demoApiBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_DEMO_API_BASE_URL ?? DEFAULT_DEMO_API_BASE_URL,
  );
  // 훅이 렌더마다 새로운 dataSource 인스턴스를 받지 않도록 메모이즈한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const { data, error, loading, reset, searchByKeyword, searchByPostalCode } =
    useJapanAddress({ dataSource, debounceMs: 250 });
  const [postalCode, setPostalCode] = useState(DEFAULT_POSTAL_CODE);
  const [keyword, setKeyword] = useState(DEFAULT_KEYWORD);
  const {
    apiHealth,
    apiHealthError,
    apiHealthLoading,
    apiReady,
    apiStatusView,
    retryHealthCheck,
  } = useDemoApiHealth(demoApiBaseUrl, loading);

  const addresses = data?.elements ?? [];
  // health가 끝나기 전이거나 API가 not ready이면 검색을 막아 안내 문구와 실제 동작을 일치시킨다.
  const searchDisabled = loading || apiHealthLoading || !apiReady;

  function handleReset() {
    // 훅 상태와 데모 입력 기본값을 함께 초기화해 재현 가능한 시작 상태로 되돌린다.
    reset();
    setPostalCode(DEFAULT_POSTAL_CODE);
    setKeyword(DEFAULT_KEYWORD);
  }

  return (
    <main style={demoPageStyle}>
      <div style={{ margin: "0 auto", maxWidth: "1080px" }}>
        <DemoHeroSection
          demoApiBaseUrl={demoApiBaseUrl}
          apiHealth={apiHealth}
          apiHealthError={apiHealthError}
          apiHealthLoading={apiHealthLoading}
          apiStatusView={apiStatusView}
          onRetry={retryHealthCheck}
          panelStyle={demoPanelStyle}
        />

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          <DemoSearchPanel
            postalCode={postalCode}
            keyword={keyword}
            searchDisabled={searchDisabled}
            onPostalCodeChange={setPostalCode}
            onKeywordChange={setKeyword}
            onPostalCodeSearch={() => {
              void searchByPostalCode(postalCode);
            }}
            onKeywordSearch={() => {
              void searchByKeyword(keyword);
            }}
            onReset={handleReset}
            panelStyle={demoPanelStyle}
          />
          <DemoResultsPanel
            panelStyle={demoPanelStyle}
            resultMessage={apiStatusView.resultMessage}
            errorMessage={error?.message ?? null}
            addresses={addresses}
          />
        </section>
      </div>
    </main>
  );
}
