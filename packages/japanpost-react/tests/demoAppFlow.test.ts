import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../../apps/demo/src/App";

type MockJsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): MockJsonResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function requirePendingRetry(
  resolveHealthRetry: ((value: MockJsonResponse) => void) | null,
): (value: MockJsonResponse) => void {
  if (!resolveHealthRetry) {
    throw new Error("Expected the retry health request to stay pending");
  }

  return resolveHealthRetry;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("demo app flow", () => {
  it("tells the user to start apps/minimal-api in the hero and status card", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    expect(screen.getAllByText("apps/minimal-api")).toHaveLength(2);
  });

  it("enables search after a successful initial health check", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(StrictMode, null, createElement(App)));

    expect(screen.getByText(/checking get \/health/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeEnabled();
  });

  it("resets both results and current input values", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        return jsonResponse(200, {
          elements: [
            {
              postalCode: "1500001",
              prefecture: "Tokyo",
              city: "Shibuya-ku",
              town: "Jingumae",
              address: "Tokyo Shibuya-ku Jingumae 4 Omotesando",
              provider: "japan-post",
            },
          ],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: 20,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    const postalCodeInput = screen.getByLabelText("Postal code");
    const keywordInput = screen.getByLabelText("Address keyword");

    fireEvent.change(postalCodeInput, { target: { value: "150-0001" } });
    fireEvent.change(keywordInput, { target: { value: "渋谷" } });

    fireEvent.click(screen.getByRole("button", { name: "Search postal code" }));

    await waitFor(() => {
      expect(
        screen.getByText(/tokyo shibuya-ku jingumae 4 omotesando/i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(postalCodeInput).toHaveValue("102-0072");
    expect(keywordInput).toHaveValue("千代田");
    expect(screen.getByText(/no addresses loaded yet/i)).toBeInTheDocument();
  });

  it("blocks searches until the demo API server is ready", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(503, {
          ok: false,
          error: "JAPAN_POST_CLIENT_ID is required",
        });
      }

      if (
        url.includes("/q/japanpost/searchcode") ||
        url.includes("/q/japanpost/addresszip")
      ) {
        throw new Error(
          `Search should not run while the demo API server is not ready: ${url}`,
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(
        screen.getByText(/search is disabled until the demo api server is ready/i),
      ).toBeInTheDocument();
    });

    fireEvent.submit(
      screen.getByLabelText("Postal code").closest("form") as HTMLFormElement,
    );
    fireEvent.submit(
      screen
        .getByLabelText("Address keyword")
        .closest("form") as HTMLFormElement,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the health check and re-enables search after real mode becomes ready", async () => {
    let healthRequestCount = 0;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        healthRequestCount += 1;

        if (healthRequestCount === 1) {
          return jsonResponse(503, {
            ok: false,
            error: "JAPAN_POST_CLIENT_ID is required",
          });
        }

        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(
        screen.getByText(/search is disabled until the demo api server is ready/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: /retry health check/i }),
    );

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    expect(healthRequestCount).toBe(2);
    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeEnabled();
  });

  it("keeps search disabled during a manual health retry even when the last known state was ready", async () => {
    let resolveHealthRetry: ((value: MockJsonResponse) => void) | null = null;
    let healthRequestCount = 0;
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        healthRequestCount += 1;

        if (healthRequestCount === 1) {
          return Promise.resolve(
            jsonResponse(200, {
              ok: true,
            }),
          );
        }

        return new Promise<MockJsonResponse>((resolve) => {
          resolveHealthRetry = resolve;
        });
      }

      if (
        url.includes("/q/japanpost/searchcode") ||
        url.includes("/q/japanpost/addresszip")
      ) {
        throw new Error(
          `Search should stay blocked during manual retry: ${url}`,
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", { name: /retry health check/i }),
    );

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeDisabled();

    fireEvent.submit(
      screen.getByLabelText("Postal code").closest("form") as HTMLFormElement,
    );
    fireEvent.submit(
      screen
        .getByLabelText("Address keyword")
        .closest("form") as HTMLFormElement,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const finishRealModeRetry = requirePendingRetry(resolveHealthRetry);

    finishRealModeRetry(
      jsonResponse(200, {
        ok: true,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });
  });

  it("retries the health check and re-enables search after the demo API server becomes reachable", async () => {
    let resolveHealthRetry: ((value: MockJsonResponse) => void) | null = null;
    let healthRequestCount = 0;
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        healthRequestCount += 1;

        if (healthRequestCount === 1) {
          return Promise.reject(new Error("Failed to fetch"));
        }

        return new Promise<MockJsonResponse>((resolve) => {
          resolveHealthRetry = resolve;
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(
        screen.getByText(/demo api server unreachable/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: /retry health check/i }),
    );

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeDisabled();
    const finishReachabilityRetry = requirePendingRetry(resolveHealthRetry);

    finishReachabilityRetry(
      jsonResponse(200, {
        ok: true,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    expect(healthRequestCount).toBe(2);
    expect(
      screen.getByRole("button", { name: "Search postal code" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Search keyword" }),
    ).toBeEnabled();
  });

  it("shows a status-based provider error after a ready demo API search fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        return jsonResponse(404, {
          detail: "No matching addresses found",
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Search postal code" }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Search postal code" }));

    await waitFor(() => {
      expect(
        screen.getByText(/request failed with status 404/i),
      ).toBeInTheDocument();
    });
  });
});
