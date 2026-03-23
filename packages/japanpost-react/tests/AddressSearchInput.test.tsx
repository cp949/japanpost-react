import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddressSearchInput } from "../src/components/AddressSearchInput";

describe("AddressSearchInput", () => {
  it("trims the search keyword before submitting", () => {
    const onSearch = vi.fn();

    render(<AddressSearchInput onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText("Address keyword"), {
      target: { value: " Tokyo " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith("Tokyo");
  });

  it("reflects an externally controlled value", () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <AddressSearchInput onSearch={onSearch} value="Tokyo" />,
    );

    expect(screen.getByLabelText("Address keyword")).toHaveValue("Tokyo");

    rerender(<AddressSearchInput onSearch={onSearch} value="Osaka" />);

    expect(screen.getByLabelText("Address keyword")).toHaveValue("Osaka");
  });

  it("forwards input and button props", () => {
    const onSearch = vi.fn();

    render(
      <AddressSearchInput
        onSearch={onSearch}
        inputProps={{
          id: "address-query",
          name: "query",
          placeholder: "Search by area",
          autoComplete: "street-address",
        }}
        buttonProps={{
          name: "submitAddressSearch",
          "aria-label": "Run address search",
        }}
      />,
    );

    const input = screen.getByLabelText("Address keyword");
    const button = screen.getByRole("button", { name: "Run address search" });

    expect(input).toHaveAttribute("id", "address-query");
    expect(input).toHaveAttribute("name", "query");
    expect(input).toHaveAttribute("placeholder", "Search by area");
    expect(input).toHaveAttribute("autocomplete", "street-address");
    expect(button).toHaveAttribute("name", "submitAddressSearch");
  });
});
