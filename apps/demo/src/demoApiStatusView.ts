import type { DemoApiHealth } from "./demoApi";

/**
 * health 체크와 검색 상태를 데모 화면 문구로 변환한다.
 * 컴포넌트 쪽에서 조건식을 반복하지 않도록 "상태 해석"을 한 곳에 모아 둔다.
 */
export type DemoApiStatusView = {
  statusColor: string;
  statusSummary: string | null;
  statusDetail: string | null;
  warningMessage: string | null;
  resultMessage: string;
};

export function getDemoApiStatusView(args: {
  loading: boolean;
  health: DemoApiHealth | null;
  error: string | null;
  searchLoading: boolean;
  retrying?: boolean;
}): DemoApiStatusView {
  const { loading, health, error, searchLoading, retrying = false } = args;

  if (loading) {
    // health 판정이 끝나기 전에는 검색을 열 수 없으므로 준비 중 메시지를 우선 노출한다.
    return {
      statusColor: "#5a6573",
      statusSummary: "Checking API health",
      statusDetail: retrying
        ? error
          ? "Retrying GET /health now after the browser could not reach the demo API server."
          : "Retrying GET /health now so the demo can confirm whether search can be enabled again."
        : "Checking GET /health so the demo can confirm whether search should be enabled.",
      warningMessage: retrying
        ? error
          ? "The last health check could not reach the demo API server, but search stays disabled until this retry finishes."
          : "Search stays disabled until the retry finishes."
        : "Search stays disabled until the health check finishes.",
      resultMessage: searchLoading
        ? "Loading addresses from the demo API server..."
        : "Checking the demo API server health before enabling search.",
    };
  }

  if (error) {
    // 서버 미도달은 "서버는 응답하지만 not ready"와 UX 의미가 다르므로 별도 상태다.
    return {
      statusColor: "#8a1f1f",
      statusSummary: "Demo API server unreachable",
      statusDetail: null,
      warningMessage: `Search is disabled until the demo API server is reachable. Start or reconnect apps/minimal-api, then try again. ${error}`,
      resultMessage:
        "Start or reconnect the demo API server before searching. The browser could not reach GET /health.",
    };
  }

  if (health && !health.ok) {
    // 503 계열 준비 안 됨은 서버 도달 성공 상태이므로 설정 문제 중심으로 안내한다.
    return {
      statusColor: "#8a1f1f",
      statusSummary: `Not ready`,
      statusDetail:
        health.error ?? "GET /health reported that the demo API server is not ready.",
      warningMessage: `Search is disabled until the demo API server is ready. ${health.error ? `${health.error} Configure apps/minimal-api and try again.` : "Configure apps/minimal-api and try again."}`,
      resultMessage:
        "Resolve the demo API server configuration first. Search stays disabled until GET /health reports ok: true.",
    };
  }

  if (health?.ok) {
    return {
      statusColor: "#1d5f3a",
      statusSummary: `Ready`,
      statusDetail: `GET /health returned ok: true.`,
      warningMessage: null,
      resultMessage: searchLoading
        ? "Loading addresses from the demo API server..."
        : "Search by postal code or keyword to see normalized addresses.",
    };
  }

  return {
    statusColor: "#5a6573",
    statusSummary: null,
    statusDetail: null,
    warningMessage: null,
    resultMessage: searchLoading
      ? "Loading addresses from the demo API server..."
      : "Search by postal code or keyword to see normalized addresses.",
  };
}
