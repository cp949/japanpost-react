import type { CSSProperties } from "react";

type DemoSearchPanelProps = {
  postalCode: string;
  keyword: string;
  searchDisabled: boolean;
  onPostalCodeChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onPostalCodeSearch: () => void;
  onKeywordSearch: () => void;
  onReset: () => void;
  panelStyle: CSSProperties;
};

export function DemoSearchPanel({
  postalCode,
  keyword,
  searchDisabled,
  onPostalCodeChange,
  onKeywordChange,
  onPostalCodeSearch,
  onKeywordSearch,
  onReset,
  panelStyle,
}: DemoSearchPanelProps) {
  return (
    <div style={{ ...panelStyle, padding: "24px" }}>
      <h2 style={{ marginTop: 0 }}>Search Inputs</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (searchDisabled) {
            return;
          }
          onPostalCodeSearch();
        }}
        style={{ display: "grid", gap: "10px", marginBottom: "18px" }}
      >
        <label style={{ fontWeight: 600 }} htmlFor="postal-code">
          Postal code
        </label>
        <input
          id="postal-code"
          value={postalCode}
          onChange={(event) => onPostalCodeChange(event.target.value)}
          placeholder="102-0072"
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(22, 34, 51, 0.18)",
            background: "#fffdf9",
          }}
        />
        <button
          type="submit"
          disabled={searchDisabled}
          style={{
            padding: "12px 14px",
            borderRadius: "999px",
            border: "none",
            background: searchDisabled ? "#94a0b2" : "#162233",
            color: "white",
            cursor: searchDisabled ? "not-allowed" : "pointer",
          }}
        >
          Search postal code
        </button>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (searchDisabled) {
            return;
          }
          onKeywordSearch();
        }}
        style={{ display: "grid", gap: "10px" }}
      >
        <label style={{ fontWeight: 600 }} htmlFor="keyword">
          Address keyword
        </label>
        <input
          id="keyword"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="千代田"
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(22, 34, 51, 0.18)",
            background: "#fffdf9",
          }}
        />
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={searchDisabled}
            style={{
              padding: "12px 14px",
              borderRadius: "999px",
              border: "none",
              background: searchDisabled ? "#c6a694" : "#8b4c2d",
              color: "white",
              cursor: searchDisabled ? "not-allowed" : "pointer",
            }}
          >
            Search keyword
          </button>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: "12px 14px",
              borderRadius: "999px",
              border: "1px solid rgba(22, 34, 51, 0.16)",
              background: "transparent",
              color: "#162233",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
