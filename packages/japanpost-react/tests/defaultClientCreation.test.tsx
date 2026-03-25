import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

function createPage() {
  return {
    elements: [
      {
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda-ku",
        town: "Chiyoda",
        address: "Tokyo Chiyoda-ku Chiyoda",
        provider: "japan-post" as const,
      },
    ],
    totalElements: 1,
    pageNumber: 0,
    rowsPerPage: 100,
  };
}

describe("data-source hook usage", () => {
  it("uses the provided data source directly for postal-code lookups", async () => {
    const { useJapanPostalCode } = await import(
      "../src/react/useJapanPostalCode"
    );
    const page = createPage();
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue(page),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("100-0001");
    });

    expect(result.current.data).toEqual(page);
    expect(dataSource.lookupPostalCode).toHaveBeenCalledTimes(1);
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
  });

  it("uses the provided data source directly for keyword searches", async () => {
    const { useJapanAddressSearch } = await import(
      "../src/react/useJapanAddressSearch"
    );
    const page = createPage();
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue(page),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource }),
    );

    await act(async () => {
      await result.current.search(" Tokyo ");
    });

    expect(result.current.data).toEqual(page);
    expect(dataSource.searchAddress).toHaveBeenCalledTimes(1);
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
  });

  it("passes an AbortSignal option to postal-code lookups", async () => {
    const { useJapanPostalCode } = await import(
      "../src/react/useJapanPostalCode"
    );
    const page = createPage();
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue(page),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("100-0001");
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
  });

  it("passes an AbortSignal option to keyword searches", async () => {
    const { useJapanAddressSearch } = await import(
      "../src/react/useJapanAddressSearch"
    );
    const page = createPage();
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue(page),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource }),
    );

    await act(async () => {
      await result.current.search("Tokyo");
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
  });
});
