import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { useJapanPostalCode } from "../src/react/useJapanPostalCode";
import type { JapanAddress, Page } from "../src/core/types";

describe("useJapanPostalCode", () => {
  it("loads postal-code results and exposes loading state", async () => {
    let resolveLookup:
      | ((value: Page<JapanAddress>) => void)
      | null = null;
    const dataSource = {
      lookupPostalCode: vi.fn().mockImplementation(
        () =>
          new Promise<Page<JapanAddress>>((resolve) => {
            resolveLookup = (value) => resolve(value);
          }),
      ),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    act(() => {
      void result.current.search("100-0001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveLookup?.({
        elements: [
          {
            postalCode: "1000001",
            prefecture: "Tokyo",
            city: "Chiyoda-ku",
            town: "Chiyoda",
            address: "Tokyo Chiyoda-ku Chiyoda",
            provider: "japan-post",
          },
        ],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 20,
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(dataSource.lookupPostalCode).toHaveBeenCalledWith(
      "1000001",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data?.elements).toEqual([
      {
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda-ku",
        town: "Chiyoda",
        address: "Tokyo Chiyoda-ku Chiyoda",
        provider: "japan-post",
      },
    ]);
    expect(result.current.data?.totalElements).toBe(1);
  });

  it("keeps only the latest postal-code result when requests resolve out of order", async () => {
    let resolveFirst:
      | ((value: Page<JapanAddress>) => void)
      | null = null;
    let resolveSecond:
      | ((value: Page<JapanAddress>) => void)
      | null = null;
    const dataSource = {
      lookupPostalCode: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Page<JapanAddress>>((resolve) => {
              resolveFirst = (value) => resolve(value);
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<Page<JapanAddress>>((resolve) => {
              resolveSecond = (value) => resolve(value);
            }),
        ),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    act(() => {
      void result.current.search("1000001");
      void result.current.search("1500001");
    });

    await act(async () => {
      resolveSecond?.({
        elements: [
          {
            postalCode: "1500001",
            prefecture: "Tokyo",
            city: "Shibuya-ku",
            town: "Jingumae",
            address: "Tokyo Shibuya-ku Jingumae",
            provider: "japan-post",
          },
        ],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 20,
      });
    });

    await waitFor(() => {
      expect(result.current.data?.elements[0]?.postalCode).toBe("1500001");
    });

    await act(async () => {
      resolveFirst?.({
        elements: [
          {
            postalCode: "1000001",
            prefecture: "Tokyo",
            city: "Chiyoda-ku",
            town: "Chiyoda",
            address: "Tokyo Chiyoda-ku Chiyoda",
            provider: "japan-post",
          },
        ],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 20,
      });
    });

    expect(result.current.data?.elements[0]?.postalCode).toBe("1500001");
  });

  it("passes through postal-code prefix searches with at least three digits", async () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue({
        elements: [
          {
            postalCode: "1230000",
            prefecture: "Tokyo",
            city: "Example-ku",
            town: "Prefix",
            address: "Tokyo Example-ku Prefix",
            provider: "japan-post",
          },
        ],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("1234");
    });

    expect(dataSource.lookupPostalCode).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.data?.elements[0]?.postalCode).toBe("1230000");
  });

  it("surfaces invalid postal-code errors instead of truncating malformed inputs", async () => {
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("12");
    });

    await waitFor(() => {
      expect(result.current.error?.code).toBe("invalid_postal_code");
    });

    expect(dataSource.lookupPostalCode).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("aborts the previous lookup when a new postal-code search starts", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: ((value: Page<JapanAddress>) => void) | null = null;
    let resolveSecond: ((value: Page<JapanAddress>) => void) | null = null;
    const dataSource = {
      lookupPostalCode: vi
        .fn()
        .mockImplementationOnce(
          (_postalCode: string, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return new Promise<Page<JapanAddress>>((resolve) => {
              resolveFirst = resolve;
            });
          },
        )
        .mockImplementationOnce(
          (_postalCode: string, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return new Promise<Page<JapanAddress>>((resolve) => {
              resolveSecond = resolve;
            });
          },
        ),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    act(() => {
      void result.current.search("1000001");
      void result.current.search("1500001");
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => {
      resolveFirst?.({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      });
      resolveSecond?.({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      });
    });
  });

  it("aborts the in-flight lookup when reset is called", async () => {
    let capturedSignal: AbortSignal | undefined;
    const dataSource = {
      lookupPostalCode: vi.fn(
        (_postalCode: string, options?: { signal?: AbortSignal }) =>
          new Promise<Page<JapanAddress>>((_resolve) => {
            capturedSignal = options?.signal;
          }),
      ),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    act(() => {
      void result.current.search("1000001");
    });

    act(() => {
      result.current.reset();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("keeps public function references stable across rerenders with the same data source", () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
      searchAddress: vi.fn(),
    };

    const { result, rerender } = renderHook(
      ({ currentDataSource }) =>
        useJapanPostalCode({ dataSource: currentDataSource }),
      {
        initialProps: { currentDataSource: dataSource },
      },
    );

    const initialSearch = result.current.search;
    const initialReset = result.current.reset;

    rerender({ currentDataSource: dataSource });

    expect(result.current.search).toBe(initialSearch);
    expect(result.current.reset).toBe(initialReset);
  });
});
