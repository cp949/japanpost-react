import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

describe("data-source hook usage", () => {
  it("uses the provided data source directly for postal-code lookups", async () => {
    const { useJapanPostalCode } = await import(
      "../src/react/useJapanPostalCode"
    );
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue([]),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("100-0001");
    });

    expect(dataSource.lookupPostalCode).toHaveBeenCalledTimes(1);
    expect(dataSource.lookupPostalCode).toHaveBeenCalledWith(
      "1000001",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("uses the provided data source directly for keyword searches", async () => {
    const { useJapanAddressSearch } = await import(
      "../src/react/useJapanAddressSearch"
    );
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue([]),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource }),
    );

    await act(async () => {
      await result.current.search(" Tokyo ");
    });

    expect(dataSource.searchAddress).toHaveBeenCalledTimes(1);
    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      "Tokyo",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("passes an AbortSignal option to postal-code lookups", async () => {
    const { useJapanPostalCode } = await import(
      "../src/react/useJapanPostalCode"
    );
    const dataSource = {
      lookupPostalCode: vi.fn().mockResolvedValue([]),
      searchAddress: vi.fn(),
    };

    const { result } = renderHook(() => useJapanPostalCode({ dataSource }));

    await act(async () => {
      await result.current.search("100-0001");
    });

    expect(dataSource.lookupPostalCode).toHaveBeenCalledWith(
      "1000001",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("passes an AbortSignal option to keyword searches", async () => {
    const { useJapanAddressSearch } = await import(
      "../src/react/useJapanAddressSearch"
    );
    const dataSource = {
      lookupPostalCode: vi.fn(),
      searchAddress: vi.fn().mockResolvedValue([]),
    };

    const { result } = renderHook(() =>
      useJapanAddressSearch({ dataSource }),
    );

    await act(async () => {
      await result.current.search("Tokyo");
    });

    expect(dataSource.searchAddress).toHaveBeenCalledWith(
      "Tokyo",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
