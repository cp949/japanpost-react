import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useJapanAddressSearch } from "../src/react/useJapanAddressSearch";
import type { JapanAddress, Page } from "../src/core/types";

describe("useJapanAddressSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("supports debounced keyword search", async () => {
    vi.useFakeTimers();

    const page: Page<JapanAddress> = {
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 20,
    };
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue(page),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource, debounceMs: 200 }),
    );

    let searchPromise: Promise<unknown> | undefined;

    act(() => {
      searchPromise = result.current.search("Tokyo");
    });

    expect(dataSource.searchAddress).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await searchPromise;
    });

    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      {
        freeword: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data).toEqual(page);
  });

  it("settles superseded debounced searches with null", async () => {
    vi.useFakeTimers();

    const page: Page<JapanAddress> = {
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 20,
    };
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue(page),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource, debounceMs: 200 }),
    );

    let firstPromise: Promise<unknown> | undefined;
    let secondPromise: Promise<unknown> | undefined;

    act(() => {
      firstPromise = result.current.search("Tokyo");
      secondPromise = result.current.search("Osaka");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await firstPromise;
      await secondPromise;
    });

    await expect(firstPromise).resolves.toBeNull();
    await expect(secondPromise).resolves.toEqual(page);
    expect(dataSource.searchAddress).toHaveBeenCalledTimes(1);
    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      {
        freeword: "Osaka",
        pageNumber: 0,
        rowsPerPage: 100,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("aborts the previous immediate keyword search when a new one starts", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: ((value: Page<JapanAddress>) => void) | null = null;
    let resolveSecond: ((value: Page<JapanAddress>) => void) | null = null;
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi
        .fn()
        .mockImplementationOnce(
          (_request, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return new Promise<Page<JapanAddress>>((resolve) => {
              resolveFirst = resolve;
            });
          },
        )
        .mockImplementationOnce(
          (_request, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return new Promise<Page<JapanAddress>>((resolve) => {
              resolveSecond = resolve;
            });
          },
        ),
    };

    const { result } = renderHook(() => useJapanAddressSearch({ dataSource }));

    act(() => {
      void result.current.search("Tokyo");
      void result.current.search("Osaka");
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

  it("aborts a pending immediate keyword search when reset is called", async () => {
    let capturedSignal: AbortSignal | undefined;
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn(
        (_request, options?: { signal?: AbortSignal }) =>
          new Promise<Page<JapanAddress>>((_resolve) => {
            capturedSignal = options?.signal;
          }),
      ),
    };

    const { result } = renderHook(() => useJapanAddressSearch({ dataSource }));

    act(() => {
      void result.current.search("Tokyo");
    });

    act(() => {
      result.current.reset();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("keeps public function references stable across rerenders with the same options", () => {
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    };

    const { result, rerender } = renderHook(
      ({ currentDataSource, currentDebounceMs }) =>
        useJapanAddressSearch({
          dataSource: currentDataSource,
          debounceMs: currentDebounceMs,
        }),
      {
        initialProps: {
          currentDataSource: dataSource,
          currentDebounceMs: 200,
        },
      },
    );

    const initialSearch = result.current.search;
    const initialReset = result.current.reset;

    rerender({
      currentDataSource: dataSource,
      currentDebounceMs: 200,
    });

    expect(result.current.search).toBe(initialSearch);
    expect(result.current.reset).toBe(initialReset);
  });
});
