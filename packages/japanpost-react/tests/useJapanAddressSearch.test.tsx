import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JapanAddressSearchInput } from "../src";
import { useJapanAddressSearch } from "../src/react/useJapanAddressSearch";
import type {
  JapanAddress,
  Page,
} from "../src/core/types";

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
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data).toEqual(page);
  });

  it("supports debounced structured address searches with trimmed fields and pager overrides", async () => {
    vi.useFakeTimers();

    const page: Page<JapanAddress> = {
      elements: [],
      totalElements: 0,
      pageNumber: 2,
      rowsPerPage: 50,
    };
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn(
        (_request, options?: { signal?: AbortSignal }) => {
          expect(options?.signal).toBeInstanceOf(AbortSignal);
          return Promise.resolve(page);
        },
      ),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource, debounceMs: 200 }),
    );

    const request = {
      prefName: " 東京都 ",
      cityName: " 千代田区 ",
      townName: " 千代田 ",
      pageNumber: 2,
      rowsPerPage: 50,
      includeCityDetails: true,
      includePrefectureDetails: false,
    } satisfies JapanAddressSearchInput;

    let searchPromise: Promise<unknown> | undefined;

    act(() => {
      searchPromise = result.current.search(request);
    });

    expect(dataSource.searchAddress).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await searchPromise;
    });

    await expect(searchPromise).resolves.toEqual(page);
    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      {
        prefName: "東京都",
        cityName: "千代田区",
        townName: "千代田",
        pageNumber: 2,
        rowsPerPage: 50,
        includeCityDetails: true,
        includePrefectureDetails: false,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(dataSource.searchAddress.mock.calls[0]?.[0]).not.toHaveProperty("addressQuery");
    expect(result.current.error).toBeNull();
  });

  it("settles superseded debounced structured searches with null", async () => {
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
      firstPromise = result.current.search({
        prefName: "東京都",
        cityName: "千代田区",
      });
      secondPromise = result.current.search({
        prefName: "大阪府",
        cityName: "大阪市北区",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await secondPromise;
    });

    await expect(firstPromise).resolves.toBeNull();
    await expect(secondPromise).resolves.toEqual(page);
    expect(dataSource.searchAddress).toHaveBeenCalledTimes(1);
    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      {
        prefName: "大阪府",
        cityName: "大阪市北区",
        pageNumber: 0,
        rowsPerPage: 100,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.error).toBeNull();
  });

  it("settles a superseded in-flight search with null", async () => {
    vi.useFakeTimers();

    const signals: AbortSignal[] = [];
    const page: Page<JapanAddress> = {
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 20,
    };
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi
        .fn()
        .mockImplementationOnce(
          (_request, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return new Promise<Page<JapanAddress>>(() => {});
          },
        )
        .mockImplementationOnce(
          (_request, options?: { signal?: AbortSignal }) => {
            signals.push(options?.signal as AbortSignal);
            return Promise.resolve(page);
          },
        ),
    };

    const { result } = renderHook(() => useJapanAddressSearch({ dataSource }));

    let firstPromise: Promise<unknown> | undefined;
    let secondPromise: Promise<unknown> | undefined;

    act(() => {
      firstPromise = result.current.search("Tokyo");
      secondPromise = result.current.search("Osaka");
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("superseded search stayed pending after abort"));
      }, 20);
    });

    if (!firstPromise) {
      throw new Error("Expected first search promise to be created");
    }

    const firstSettledPromise = Promise.race([firstPromise, timeoutPromise]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
      await secondPromise;
    });

    await expect(
      firstSettledPromise,
    ).resolves.toBeNull();
    await expect(secondPromise).resolves.toEqual(page);
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

  it("cancels an immediate keyword search even if the datasource ignores abort", async () => {
    vi.useFakeTimers();

    let capturedSignal: AbortSignal | undefined;
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn(
        (_request, options?: { signal?: AbortSignal }) => {
          capturedSignal = options?.signal;
          return new Promise<Page<JapanAddress>>(() => {});
        },
      ),
    };

    const { result } = renderHook(() => useJapanAddressSearch({ dataSource }));

    let searchPromise: Promise<unknown> | undefined;

    act(() => {
      searchPromise = result.current.search("Tokyo");
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("search promise stayed pending after cancel"));
      }, 20);
    });

    if (!searchPromise) {
      throw new Error("Expected search promise to be created");
    }

    const racePromise = Promise.race([
      searchPromise,
      timeoutPromise,
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
      await racePromise;
    });

    await expect(racePromise).resolves.toBeNull();
  });

  it("cancels an in-flight keyword search without clearing settled data", async () => {
    const settledPage: Page<JapanAddress> = {
      elements: [
        {
          postalCode: "1000001",
          prefecture: "東京都",
          city: "千代田区",
          town: "千代田",
          address: "東京都千代田区千代田",
          provider: "japan-post",
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 20,
    };
    const abortedPage: Page<JapanAddress> = {
      elements: [
        {
          postalCode: "5300001",
          prefecture: "大阪府",
          city: "大阪市北区",
          town: "梅田",
          address: "大阪府大阪市北区梅田",
          provider: "japan-post",
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 20,
    };
    let capturedSignal: AbortSignal | undefined;
    let resolveInFlight: ((value: Page<JapanAddress>) => void) | null = null;
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi
        .fn()
        .mockResolvedValueOnce(settledPage)
        .mockImplementationOnce(
          (_request, options?: { signal?: AbortSignal }) => {
            capturedSignal = options?.signal;
            return new Promise<Page<JapanAddress>>((resolve) => {
              resolveInFlight = resolve;
            });
          },
        ),
    };

    const { result } = renderHook(() => useJapanAddressSearch({ dataSource }));

    let settledPromise: Promise<unknown> | undefined;
    let inFlightPromise: Promise<unknown> | undefined;

    act(() => {
      settledPromise = result.current.search("Tokyo");
    });

    await act(async () => {
      await settledPromise;
    });
    expect(result.current.data).toEqual(settledPage);

    act(() => {
      inFlightPromise = result.current.search("Osaka");
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(settledPage);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveInFlight?.(abortedPage);
      await inFlightPromise;
    });

    await expect(inFlightPromise).resolves.toBeNull();
    expect(result.current.data).toEqual(settledPage);
    expect(result.current.error).toBeNull();
  });

  it("cancels a pending debounced search without surfacing an error", async () => {
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

    const request = {
      prefName: "東京都",
      cityName: "千代田区",
      pageNumber: 0,
      rowsPerPage: 100,
      includeCityDetails: true,
      includePrefectureDetails: true,
    } satisfies JapanAddressSearchInput;

    let searchPromise: Promise<unknown> | undefined;

    act(() => {
      searchPromise = result.current.search(request);
    });

    expect(result.current.cancel).toEqual(expect.any(Function));

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await searchPromise;
    });

    await expect(searchPromise).resolves.toBeNull();
    expect(dataSource.searchAddress).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
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
    const initialCancel = result.current.cancel;

    rerender({
      currentDataSource: dataSource,
      currentDebounceMs: 200,
    });

    expect(result.current.search).toBe(initialSearch);
    expect(result.current.reset).toBe(initialReset);
    expect(result.current.cancel).toBe(initialCancel);
  });
});
