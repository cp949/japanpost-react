import type { DemoApiHealth } from "./demoApi";
import type { DemoApiStatusView } from "./demoApiStatusView";

type DemoApiStatusCardProps = {
  demoApiBaseUrl: string;
  apiHealth: DemoApiHealth | null;
  apiHealthError: string | null;
  apiHealthLoading: boolean;
  apiStatusView: DemoApiStatusView;
  onRetry: () => void;
};

export function DemoApiStatusCard({
  demoApiBaseUrl,
  apiHealth,
  apiHealthError,
  apiHealthLoading,
  apiStatusView,
  onRetry,
}: DemoApiStatusCardProps) {
  return (
    <div
      style={{
        justifySelf: "end",
        padding: "16px 18px",
        borderRadius: "20px",
        background: "rgba(139, 76, 45, 0.08)",
        minWidth: "240px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Current Source
      </div>
      <div style={{ marginTop: "6px", fontSize: "1.1rem", fontWeight: 600 }}>
        Demo API server
      </div>
      <div style={{ marginTop: "8px", color: "#5a6573", lineHeight: 1.5 }}>
        Start <code>apps/minimal-api</code> on <code>{demoApiBaseUrl}</code> with
        valid Japan Post credentials to back this UI.
      </div>
      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(22, 34, 51, 0.08)",
          color: "#5a6573",
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          API Health
        </div>
        <button
          type="button"
          disabled={apiHealthLoading}
          onClick={onRetry}
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "999px",
            border: "1px solid rgba(22, 34, 51, 0.16)",
            background: apiHealthLoading
              ? "rgba(148, 160, 178, 0.2)"
              : "#fffdf9",
            color: "#162233",
            cursor: apiHealthLoading ? "not-allowed" : "pointer",
          }}
        >
          {apiHealthLoading ? "Checking..." : "Retry health check"}
        </button>
        {apiHealth ? (
          <div style={{ marginTop: "8px" }}>
            <div style={{ fontWeight: 600, color: apiStatusView.statusColor }}>
              {apiStatusView.statusSummary}
            </div>
            <div style={{ marginTop: "4px" }}>{apiStatusView.statusDetail}</div>
            {apiStatusView.warningMessage ? (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "14px",
                  background: "rgba(160, 52, 52, 0.12)",
                  color: "#8a1f1f",
                  fontWeight: 600,
                }}
              >
                {apiStatusView.warningMessage}
              </div>
            ) : null}
          </div>
        ) : apiHealthError ? (
          <div style={{ marginTop: "8px", color: "#8a1f1f" }}>
            {apiHealthLoading
              ? apiStatusView.statusSummary
              : `${apiStatusView.statusSummary}: ${apiHealthError}`}
            <div
              style={{
                marginTop: "10px",
                padding: "10px 12px",
                borderRadius: "14px",
                background: "rgba(160, 52, 52, 0.12)",
                color: "#8a1f1f",
                fontWeight: 600,
              }}
            >
              {apiStatusView.warningMessage}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "8px" }}>
            {apiHealthLoading
              ? "Checking GET /health..."
              : "Retry GET /health to refresh API status."}
          </div>
        )}
      </div>
    </div>
  );
}
