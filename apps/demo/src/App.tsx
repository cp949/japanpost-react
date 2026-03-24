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

const DEFAULT_POSTAL_CODE = "102-0072";
const DEFAULT_KEYWORD = "千代田";

export default function App() {
  const demoApiBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_DEMO_API_BASE_URL ?? DEFAULT_DEMO_API_BASE_URL,
  );
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
  const searchDisabled = loading || apiHealthLoading || !apiReady;

  function handleReset() {
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
