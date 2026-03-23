import { describe, expect, it } from "vitest";

import { getDemoApiStatusView } from "../../../apps/demo/src/demoApiStatusView";

describe("getDemoApiStatusView", () => {
  it("returns initial health-check messaging before any retry happens", () => {
    expect(
      getDemoApiStatusView({
        loading: true,
        health: null,
        error: null,
        searchLoading: false,
      }),
    ).toMatchObject({
      statusSummary: "Checking API health",
      statusDetail:
        "Checking GET /health so the demo can confirm whether search should be enabled.",
      warningMessage: "Search stays disabled until the health check finishes.",
      resultMessage:
        "Checking the demo API server health before enabling search.",
    });
  });

  it("returns retry guidance while loading after an unreachable error", () => {
    expect(
      getDemoApiStatusView({
        loading: true,
        health: null,
        error: "Failed to fetch",
        searchLoading: false,
        retrying: true,
      }),
    ).toMatchObject({
      statusSummary: "Checking API health",
      statusDetail:
        "Retrying GET /health now after the browser could not reach the demo API server.",
      warningMessage:
        "The last health check could not reach the demo API server, but search stays disabled until this retry finishes.",
      resultMessage:
        "Checking the demo API server health before enabling search.",
    });
  });

  it("returns not-ready messaging when the demo API server is not ready", () => {
    expect(
      getDemoApiStatusView({
        loading: false,
        health: {
          ok: false,
          error: "JAPAN_POST_CLIENT_ID is required",
        },
        error: null,
        searchLoading: false,
      }),
    ).toMatchObject({
      statusSummary: "Not ready",
      statusDetail: "JAPAN_POST_CLIENT_ID is required",
      warningMessage: expect.stringContaining("apps/minimal-api"),
    });
  });

  it("points unreachable guidance at apps/minimal-api", () => {
    expect(
      getDemoApiStatusView({
        loading: false,
        health: null,
        error: "Failed to fetch",
        searchLoading: false,
      }),
    ).toMatchObject({
      warningMessage: expect.stringContaining("apps/minimal-api"),
      resultMessage: expect.stringContaining("demo API server"),
    });
  });

  it("returns ready messaging when the demo API server is ready", () => {
    expect(
      getDemoApiStatusView({
        loading: false,
        health: {
          ok: true,
        },
        error: null,
        searchLoading: false,
      }),
    ).toMatchObject({
      statusSummary: "Ready",
      resultMessage:
        "Search by postal code or keyword to see normalized addresses.",
    });
  });
});
