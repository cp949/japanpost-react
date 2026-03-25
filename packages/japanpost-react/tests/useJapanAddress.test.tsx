import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  JapanAddressSearchInput,
  JapanPostalCodeSearchInput,
} from "../src";
import { useJapanAddress } from "../src/react/useJapanAddress";
import { createJapanAddressError } from "../src/core/errors";

describe("useJapanAddress", () => {
  it("forwards request objects through the combined hook API", async () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 100,
      }),
      searchAddress: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    };

    const { result } = renderHook(() => useJapanAddress({ dataSource }));

    const postalCodeInput = {
      postalCode: "100-0001",
      pageNumber: 2,
      rowsPerPage: 25,
      includeParenthesesTown: true,
    } satisfies JapanPostalCodeSearchInput;

    await act(async () => {
      await result.current.searchByPostalCode(postalCodeInput);
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

    const addressSearchInput = {
      prefName: " Tokyo ",
      cityName: " Chiyoda-ku ",
      pageNumber: 1,
      rowsPerPage: 10,
      includeCityDetails: true,
      includePrefectureDetails: false,
    } satisfies JapanAddressSearchInput;

    await act(async () => {
      await result.current.searchByAddressQuery(addressSearchInput);
    });

    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      {
        prefName: "Tokyo",
        cityName: "Chiyoda-ku",
        pageNumber: 1,
        rowsPerPage: 10,
        includeCityDetails: true,
        includePrefectureDetails: false,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("provides a unified resettable API", async () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
      searchAddress: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    };

    const { result } = renderHook(() => useJapanAddress({ dataSource }));

    await act(async () => {
      await result.current.searchByPostalCode("1000001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toMatchObject({
      elements: [],
      totalElements: 0,
    });

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
        .mockResolvedValueOnce({
          elements: [],
          totalElements: 0,
          pageNumber: 0,
          rowsPerPage: 20,
        }),
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
      expect(result.current.data).toMatchObject({
        elements: [],
        totalElements: 0,
      });
    });

    expect(result.current.error).toBeNull();
  });

  it("keeps public function references stable across rerenders with the same options", () => {
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
      searchAddress: vi.fn().mockResolvedValue({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
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
    const initialSearchByAddressQuery = result.current.searchByAddressQuery;
    const initialReset = result.current.reset;

    rerender({
      currentDataSource: dataSource,
      currentDebounceMs: 200,
    });

    expect(result.current.searchByPostalCode).toBe(initialSearchByPostalCode);
    expect(result.current.searchByAddressQuery).toBe(initialSearchByAddressQuery);
    expect(result.current.reset).toBe(initialReset);
  });
});
