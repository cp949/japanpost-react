import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { useJapanAddress } from "../src/react/useJapanAddress";
import { createJapanAddressError } from "../src/core/errors";

describe("useJapanAddress", () => {
  it("provides a unified resettable API", async () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue([]),
      searchAddress: vi.fn().mockResolvedValue([]),
    };

    const { result } = renderHook(() => useJapanAddress({ dataSource }));

    await act(async () => {
      await result.current.searchByPostalCode("1000001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toMatchObject({ postalCode: "1000001" });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("clears stale errors after a later successful search", async () => {
    const dataSource = {
      lookupPostalCode: vi
        .fn()
        .mockRejectedValueOnce(
          createJapanAddressError("not_found", "missing address"),
        )
        .mockResolvedValueOnce([]),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanAddress({ dataSource }));

    await act(async () => {
      await result.current.searchByPostalCode("0000000");
    });

    await waitFor(() => {
      expect(result.current.error?.code).toBe("not_found");
    });

    await act(async () => {
      await result.current.searchByPostalCode("1000001");
    });

    await waitFor(() => {
      expect(result.current.data).toMatchObject({ postalCode: "1000001" });
    });

    expect(result.current.error).toBeNull();
  });

  it("keeps public function references stable across rerenders with the same options", () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue([]),
      searchAddress: vi.fn().mockResolvedValue([]),
    };

    const { result, rerender } = renderHook(
      ({ currentDataSource, currentDebounceMs }) =>
        useJapanAddress({
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

    const initialSearchByPostalCode = result.current.searchByPostalCode;
    const initialSearchByKeyword = result.current.searchByKeyword;
    const initialReset = result.current.reset;

    rerender({
      currentDataSource: dataSource,
      currentDebounceMs: 200,
    });

    expect(result.current.searchByPostalCode).toBe(initialSearchByPostalCode);
    expect(result.current.searchByKeyword).toBe(initialSearchByKeyword);
    expect(result.current.reset).toBe(initialReset);
  });
});
