import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { APPLICATION_COLORS } from "./application-colors";
import { ColorSwatchPicker } from "./color-swatch-picker";

const SWATCH_NAMES = [
  "Night",
  "Cream",
  "Red",
  "Green",
  "Blue",
  "Gold",
  "Yellow",
  "Orange",
  "Pink",
  "Grape",
  "Violet",
  "Indigo",
  "Cyan",
  "Teal",
  "Lime",
];

describe("ColorSwatchPicker", () => {
  it("renders exactly 15 swatches, in the required order, each 19px wide", () => {
    render(<ColorSwatchPicker value="pink.6" onChange={vi.fn()} />);

    const group = screen.getByRole("radiogroup", { name: "Color" });
    const swatches = within(group).getAllByRole("radio");

    expect(swatches).toHaveLength(15);
    expect(swatches.map((swatch) => swatch.getAttribute("aria-label"))).toEqual(
      SWATCH_NAMES,
    );
    for (const swatch of swatches) {
      expect(swatch).toHaveStyle({ width: "19px" });
    }
  });

  it("paints each swatch with shade 6 of its color", () => {
    render(<ColorSwatchPicker value="pink.6" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Pink" })).toHaveStyle({
      backgroundColor: APPLICATION_COLORS["pink.6"],
    });
    expect(screen.getByRole("radio", { name: "Cyan" })).toHaveStyle({
      backgroundColor: APPLICATION_COLORS["cyan.6"],
    });
  });

  it("marks only the swatch matching the current value as checked", () => {
    render(<ColorSwatchPicker value="pink.6" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Pink" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Cyan" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("shows no checked swatch when the value isn't one of the <name>.6 tokens", () => {
    render(<ColorSwatchPicker value="#1c7ed6" onChange={vi.fn()} />);

    for (const swatch of screen.getAllByRole("radio")) {
      expect(swatch).toHaveAttribute("aria-checked", "false");
    }

    render(<ColorSwatchPicker value="pink.7" onChange={vi.fn()} />);
    for (const swatch of screen.getAllByRole("radio")) {
      expect(swatch).toHaveAttribute("aria-checked", "false");
    }
  });

  it("calls onChange with the <name>.6 token when a swatch is clicked", () => {
    const onChange = vi.fn();
    render(<ColorSwatchPicker value="pink.6" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Cyan" }));

    expect(onChange).toHaveBeenCalledWith("cyan.6");
  });

  it("selects a swatch with the keyboard via Enter or Space", () => {
    const onChange = vi.fn();
    render(<ColorSwatchPicker value="pink.6" onChange={onChange} />);

    const cyan = screen.getByRole("radio", { name: "Cyan" });
    fireEvent.keyDown(cyan, { key: "Enter" });
    fireEvent.keyDown(cyan, { key: " " });

    expect(onChange).toHaveBeenNthCalledWith(1, "cyan.6");
    expect(onChange).toHaveBeenNthCalledWith(2, "cyan.6");
  });
});
