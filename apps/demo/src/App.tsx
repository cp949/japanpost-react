/// <reference types="vite/client" />

import type { JapanAddress } from "@cp949/japanpost-react";
import { Container, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { DemoTabPanel } from "./components/DemoTabPanel";
import { EmbeddedExamplePanel } from "./components/EmbeddedExamplePanel";
import { JapanPostalAddressField } from "./components/JapanPostalAddressField";
import { UseJapanAddressPanel } from "./components/UseJapanAddressPanel";
import { UseJapanAddressSearchPanel } from "./components/UseJapanAddressSearchPanel";
import { UseJapanPostalCodePanel } from "./components/UseJapanPostalCodePanel";
import {
  DEFAULT_DEMO_API_BASE_URL,
  normalizeBaseUrl,
  readDemoApiHealth,
} from "./demoApi";

// 데모가 처음 열렸을 때 바로 UI 변화를 확인할 수 있도록
// 대표 주소 하나를 미리 선택된 상태로 준비해 둔다.
const DEFAULT_SELECTED_ADDRESS: JapanAddress = {
  postalCode: "1020072",
  prefecture: "Tokyo",
  city: "Chiyoda-ku",
  town: "Kioicho",
  address: "Tokyo   Chiyoda-ku \nKioicho",
  provider: "japan-post",
};

type DemoTab =
  | "dialog"
  | "embedded"
  | "address-search"
  | "postal-code"
  | "address";

export default function App() {
  // 다이얼로그 예제와 일부 패널이 같은 주소를 공유하도록
  // 최상위에서 선택된 주소 상태를 관리한다.
  const [selectedAddress, setSelectedAddress] = useState(
    DEFAULT_SELECTED_ADDRESS,
  );
  const [tab, setTab] = useState<DemoTab>("dialog");
  // 환경 변수에 슬래시가 어떻게 들어오든 내부 API 유틸이 다루기 쉽게 정규화한다.
  const demoApiBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_DEMO_API_BASE_URL ?? DEFAULT_DEMO_API_BASE_URL,
  );

  useEffect(() => {
    // 데모 시작 시 API 서버가 응답 가능한지 한 번 확인해 두면
    // 개발 중 프록시나 서버 설정 문제를 조기에 알아차릴 수 있다.
    void readDemoApiHealth(demoApiBaseUrl).catch(() => undefined);
  }, [demoApiBaseUrl]);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography component="h1" variant="h4">
              Japan Postcode React Demo
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Copy this sample into your app to try the Japan Post lookup field.
            </Typography>
          </Stack>

          <Tabs
            aria-label="Demo examples"
            allowScrollButtonsMobile
            scrollButtons="auto"
            value={tab}
            variant="scrollable"
            onChange={(_event, nextTab) => setTab(nextTab as DemoTab)}
          >
            {/* 각 탭은 같은 데이터 소스를 다른 UX 패턴으로 보여주는 독립 예제다. */}
            <Tab
              aria-controls="demo-tabpanel-dialog"
              id="demo-tab-dialog"
              label="Dialog"
              value="dialog"
            />
            <Tab
              aria-controls="demo-tabpanel-embedded"
              id="demo-tab-embedded"
              label="Embedded"
              value="embedded"
            />
            <Tab
              aria-controls="demo-tabpanel-address-search"
              id="demo-tab-address-search"
              label="useJapanAddressSearch()"
              value="address-search"
            />
            <Tab
              aria-controls="demo-tabpanel-postal-code"
              id="demo-tab-postal-code"
              label="useJapanPostalCode()"
              value="postal-code"
            />
            <Tab
              aria-controls="demo-tabpanel-address"
              id="demo-tab-address"
              label="useJapanAddress()"
              value="address"
            />
          </Tabs>

          <DemoTabPanel
            id="demo-tabpanel-dialog"
            labelledBy="demo-tab-dialog"
            value={tab}
            when="dialog"
          >
            {/* 가장 기본적인 "검색 버튼 + 모달" 조합을 보여주는 예제다. */}
            <Stack spacing={2}>
              <Typography variant="h6">Dialog</Typography>
              <JapanPostalAddressField
                demoApiBaseUrl={demoApiBaseUrl}
                value={selectedAddress}
                onSelectAddress={setSelectedAddress}
              />
            </Stack>
          </DemoTabPanel>

          <DemoTabPanel
            id="demo-tabpanel-embedded"
            labelledBy="demo-tab-embedded"
            value={tab}
            when="embedded"
          >
            {/* 검색 UI를 페이지 내부에 직접 배치한 임베디드 시나리오다. */}
            <EmbeddedExamplePanel
              demoApiBaseUrl={demoApiBaseUrl}
              initialAddress={DEFAULT_SELECTED_ADDRESS}
            />
          </DemoTabPanel>

          <DemoTabPanel
            id="demo-tabpanel-address-search"
            labelledBy="demo-tab-address-search"
            value={tab}
            when="address-search"
          >
            {/* 주소 검색 훅 단독 사용법을 요청 미리보기와 함께 보여준다. */}
            <UseJapanAddressSearchPanel demoApiBaseUrl={demoApiBaseUrl} />
          </DemoTabPanel>

          <DemoTabPanel
            id="demo-tabpanel-postal-code"
            labelledBy="demo-tab-postal-code"
            value={tab}
            when="postal-code"
          >
            {/* 우편번호 검색 훅 단독 사용법을 별도 패널로 분리했다. */}
            <UseJapanPostalCodePanel demoApiBaseUrl={demoApiBaseUrl} />
          </DemoTabPanel>

          <DemoTabPanel
            id="demo-tabpanel-address"
            labelledBy="demo-tab-address"
            value={tab}
            when="address"
          >
            {/* 하나의 훅이 두 검색 모드를 모두 처리하는 통합 시나리오다. */}
            <UseJapanAddressPanel demoApiBaseUrl={demoApiBaseUrl} />
          </DemoTabPanel>
        </Stack>
      </Paper>
    </Container>
  );
}
