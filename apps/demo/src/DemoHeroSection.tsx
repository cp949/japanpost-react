import { DemoApiStatusCard } from "./DemoApiStatusCard";
import type { DemoApiHealth } from "./demoApi";
import type { DemoApiStatusView } from "./demoApiStatusView";

type DemoHeroSectionProps = {
  demoApiBaseUrl: string;
  apiHealth: DemoApiHealth | null;
  apiHealthError: string | null;
  apiHealthLoading: boolean;
  apiStatusView: DemoApiStatusView;
  onRetry: () => void;
  panelStyle: Record<string, string>;
};

export function DemoHeroSection({
  demoApiBaseUrl,
  apiHealth,
  apiHealthError,
  apiHealthLoading,
  apiStatusView,
  onRetry,
  panelStyle,
}: DemoHeroSectionProps) {
  return (
    <section
      style={{
        ...panelStyle,
        padding: "28px",
        marginBottom: "20px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "18px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          alignItems: "end",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8b4c2d",
            }}
          >
            Demo API
          </p>
          <h1
            style={{
              margin: "10px 0 12px",
              fontSize: "clamp(2.2rem, 5vw, 4rem)",
            }}
          >
            Japan Postcode React
          </h1>
          <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "44ch" }}>
            This demo browser only talks to the local{" "}
            <code>apps/minimal-api</code> server. Configure Japan Post
            credentials there when you want to exercise the real
            upstream-backed path.
          </p>
        </div>
        <DemoApiStatusCard
          demoApiBaseUrl={demoApiBaseUrl}
          apiHealth={apiHealth}
          apiHealthError={apiHealthError}
          apiHealthLoading={apiHealthLoading}
          apiStatusView={apiStatusView}
          onRetry={onRetry}
        />
      </div>
    </section>
  );
}
