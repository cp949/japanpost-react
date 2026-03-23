import type { CSSProperties } from "react";
import {
  formatJapanPostalCode,
  type JapanAddress,
} from "@cp949/japanpost-react";

type DemoResultsPanelProps = {
  panelStyle: CSSProperties;
  resultMessage: string;
  errorMessage: string | null;
  addresses: JapanAddress[];
};

export function DemoResultsPanel({
  panelStyle,
  resultMessage,
  errorMessage,
  addresses,
}: DemoResultsPanelProps) {
  return (
    <div style={{ ...panelStyle, padding: "24px" }}>
      <h2 style={{ marginTop: 0 }}>Result</h2>
      <p style={{ marginTop: 0, color: "#5a6573", lineHeight: 1.6 }}>
        {resultMessage}
      </p>
      {errorMessage ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "16px",
            background: "rgba(160, 52, 52, 0.08)",
            color: "#8a1f1f",
            marginBottom: "14px",
          }}
        >
          {errorMessage}
        </div>
      ) : null}
      {addresses.length === 0 ? (
        <p style={{ color: "#5a6573" }}>No addresses loaded yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {addresses.map((address) => (
            <article
              key={`${address.postalCode}-${address.address}`}
              style={{
                padding: "16px",
                borderRadius: "18px",
                background: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(22, 34, 51, 0.08)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#8b4c2d",
                }}
              >
                {formatJapanPostalCode(address.postalCode)}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                }}
              >
                {address.address}
              </div>
              <div style={{ marginTop: "6px", color: "#5a6573" }}>
                {address.prefectureKana || "-"} / {address.cityKana || "-"} /{" "}
                {address.townKana || "-"}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
