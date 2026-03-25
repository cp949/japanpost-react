import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { useJapanPostalCode } from "../src/react/useJapanPostalCode";
import type {
  JapanAddress,
  JapanPostalCodeSearchInput,
  Page,
} from "../src";

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
      {
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 100,
      },
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

  it("forwards structured search options to the postal-code data source", async () => {
    const page: Page<JapanAddress> = {
      elements: [],
      totalElements: 0,
      pageNumber: 2,
      rowsPerPage: 25,
    };
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue(page),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    const input: JapanPostalCodeSearchInput = {
      postalCode: "100-0001",
      pageNumber: 2,
      rowsPerPage: 25,
      includeParenthesesTown: true,
    };

    await act(async () => {
      await result.current.search(input);
    });

    expect(dataSource.lookupPostalCode).toHaveBeenCalledWith(
      {
        postalCode: "1000001",
        pageNumber: 2,
        rowsPerPage: 25,
        includeParenthesesTown: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.error).toBeNull();
  });

  it("cancels the in-flight lookup without clearing settled data", async () => {
    let resolveLookup:
      | ((value: Page<JapanAddress>) => void)
      | null = null;
    let capturedSignal: AbortSignal | undefined;
    const dataSource = {
      lookupPostalCode: vi
        .fn()
        .mockResolvedValueOnce({
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
        })
        .mockImplementationOnce((_request, options?: { signal?: AbortSignal }) => {
          capturedSignal = options?.signal;
          return new Promise<Page<JapanAddress>>((resolve) => {
            resolveLookup = resolve;
          });
        }),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    expect(result.current.cancel).toEqual(expect.any(Function));

    await act(async () => {
      await result.current.search("1000001");
    });

    expect(result.current.data?.elements[0]?.postalCode).toBe("1000001");
    expect(result.current.error).toBeNull();

    let canceledPromise: Promise<unknown> | null = null;
    act(() => {
      canceledPromise = result.current.search("1500001");
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.elements[0]?.postalCode).toBe("1000001");
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveLookup?.({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      });
    });

    await expect(canceledPromise).resolves.toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.elements[0]?.postalCode).toBe("1000001");
    expect(result.current.error).toBeNull();
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

  it("resolves superseded postal-code searches with null", async () => {
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
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<Page<JapanAddress>>((resolve) => {
              resolveSecond = resolve;
            }),
        ),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    let firstPromise: Promise<unknown> | null = null;
    let secondPromise: Promise<unknown> | null = null;

    act(() => {
      firstPromise = result.current.search("1000001");
      secondPromise = result.current.search("1500001");
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

    await expect(firstPromise).resolves.toBeNull();
    await expect(secondPromise).resolves.toEqual(
      expect.objectContaining({
        elements: [
          expect.objectContaining({
            postalCode: "1500001",
          }),
        ],
      }),
    );

    expect(result.current.error).toBeNull();
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
      {
        postalCode: "1234",
        pageNumber: 0,
        rowsPerPage: 100,
      },
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
        (_request, options?: { signal?: AbortSignal }) =>
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
    const initialCancel = result.current.cancel;
    const initialReset = result.current.reset;

    rerender({ currentDataSource: dataSource });

    expect(result.current.search).toBe(initialSearch);
    expect(result.current.cancel).toBe(initialCancel);
    expect(result.current.reset).toBe(initialReset);
  });
});
