import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PostalCodeInput } from "../src/components/PostalCodeInput";

describe("PostalCodeInput", () => {
  it("submits the normalized postal code through onSearch", () => {
    const onSearch = vi.fn();

    render(<PostalCodeInput onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText("Postal code"), {
      target: { value: "100-0001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith("1000001");
  });

  it("reflects an externally controlled value", () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <PostalCodeInput onSearch={onSearch} value="1000001" />,
    );

    expect(screen.getByLabelText("Postal code")).toHaveValue("1000001");

    rerender(<PostalCodeInput onSearch={onSearch} value="1500001" />);

    expect(screen.getByLabelText("Postal code")).toHaveValue("1500001");
  });

  it("forwards input and button props with numeric-friendly defaults", () => {
    const onSearch = vi.fn();

    render(
      <PostalCodeInput
        onSearch={onSearch}
        inputProps={{
          id: "postal-code",
          name: "postalCode",
          placeholder: "123-4567",
          "aria-describedby": "postal-help",
        }}
        buttonProps={{
          name: "submitPostalCode",
          "aria-label": "Run postal lookup",
        }}
      />,
    );

    const input = screen.getByLabelText("Postal code");
    const button = screen.getByRole("button", { name: "Run postal lookup" });

    expect(input).toHaveAttribute("id", "postal-code");
    expect(input).toHaveAttribute("name", "postalCode");
    expect(input).toHaveAttribute("placeholder", "123-4567");
    expect(input).toHaveAttribute("aria-describedby", "postal-help");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(button).toHaveAttribute("name", "submitPostalCode");
  });

  it("forwards a ref to the underlying input element", () => {
    const onSearch = vi.fn();
    const ref = { current: null as HTMLInputElement | null };

    render(<PostalCodeInput onSearch={onSearch} ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText("Postal code"));
  });
});
