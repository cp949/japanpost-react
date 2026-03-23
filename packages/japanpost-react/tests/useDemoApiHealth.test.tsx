import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDemoApiHealth } from "../../../apps/demo/src/useDemoApiHealth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDemoApiHealth", () => {
  it("ignores stale health-check results when a newer retry finishes first", async () => {
    let resolveInitial:
      | ((value: Response | PromiseLike<Response>) => void)
      | null = null;
    let resolveRetry:
      | ((value: Response | PromiseLike<Response>) => void)
      | null = null;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveInitial = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRetry = resolve;
          }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useDemoApiHealth("http://localhost:8787", false),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.retryHealthCheck();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveRetry?.({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mode: "real",
        }),
      } as Response);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.apiHealth).toEqual({
        ok: true,
        mode: "real",
      });
    });

    await act(async () => {
      resolveInitial?.({
        ok: false,
        status: 503,
        json: async () => ({
          ok: false,
          mode: "real",
          error: "stale failure",
        }),
      } as Response);
      await Promise.resolve();
    });

    expect(result.current.apiHealth).toEqual({
      ok: true,
      mode: "real",
    });
    expect(result.current.apiHealthError).toBe(null);
  });

  it("retries API health checks when requested", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          ok: false,
          mode: "real",
          error: "missing credentials",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mode: "real",
        }),
      } as Response);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useDemoApiHealth("http://localhost:8787", false),
    );

    await waitFor(() => {
      expect(result.current.apiHealth?.ok).toBe(false);
    });

    act(() => {
      result.current.retryHealthCheck();
    });

    await waitFor(() => {
      expect(result.current.apiHealth).toEqual({
        ok: true,
        mode: "real",
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stores a stable unreachable message when the health request cannot connect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const { result } = renderHook(() =>
      useDemoApiHealth("http://localhost:8787", false),
    );

    await waitFor(() => {
      expect(result.current.apiHealthError).toBe("Demo API server is unreachable");
    });
  });
});
