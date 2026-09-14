import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { ColorField } from "./color-field";

function renderField(
  overrides: Partial<React.ComponentProps<typeof ColorField>> = {},
) {
  return render(
    <MantineProvider>
      <ColorField value="pink.6" onChange={vi.fn()} {...overrides} />
    </MantineProvider>,
  );
}

// Mantine's ColorSwatch paints `color` onto an inner overlay span (a stable
// Styles API class), not onto the `data-testid` root element itself.
function getPreviewColor(): string | null {
  return (
    screen
      .getByTestId("color-field-preview")
      .querySelector<HTMLElement>(".mantine-ColorSwatch-colorOverlay")?.style
      .backgroundColor ?? null
  );
}

describe("ColorField", () => {
  it("renders an editable Autocomplete combobox, not a graphical ColorInput", () => {
    renderField();

    expect(screen.getByRole("combobox", { name: "Color" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /color/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the swatch picker wired to the same value", () => {
    renderField({ value: "cyan.6" });

    const group = screen.getByRole("radiogroup", { name: "Color" });
    expect(within(group).getAllByRole("radio").length).toBeGreaterThan(0);
    expect(within(group).getByRole("radio", { name: "Cyan" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onChange with the <name>.6 token when a swatch is clicked", () => {
    const onChange = vi.fn();
    renderField({ onChange });

    fireEvent.click(screen.getByRole("radio", { name: "Cyan" }));

    expect(onChange).toHaveBeenCalledWith("cyan.6");
  });

  it("calls onChange with a typed, free-form value from the Autocomplete", () => {
    const onChange = vi.fn();
    renderField({ onChange });

    fireEvent.change(screen.getByRole("combobox", { name: "Color" }), {
      target: { value: "#1c7ed6ff" },
    });

    expect(onChange).toHaveBeenCalledWith("#1c7ed6ff");
  });

  it("uses a caller-provided label for both the Autocomplete and the swatch group", () => {
    renderField({ label: "Module color" });

    expect(
      screen.getByRole("combobox", { name: "Module color" }),
    ).toBeInTheDocument();
    // The swatch group's own accessible name is fixed to "Color" (it comes
    // from the shared ColorSwatchPicker primitive, not this field's label).
    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
  });

  it("disables both the Autocomplete and the swatch picker when disabled (ANA-94)", () => {
    const onChange = vi.fn();
    renderField({ disabled: true, onChange });

    expect(screen.getByRole("combobox", { name: "Color" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Cyan" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a preview circle showing the current color, resolved from its token (ANA-106)", () => {
    renderField({ value: "cyan.6" });

    expect(getPreviewColor()).toBe("rgb(21, 170, 191)");
  });

  it("resolves a free-form value the same way the swatch picker would (ANA-106)", () => {
    renderField({ value: "#1c7ed6ff" });

    expect(getPreviewColor()).toBe("rgb(28, 126, 214)");
  });

  it("updates the preview immediately when a swatch selection changes the color (ANA-106)", () => {
    function ControlledField() {
      const [value, setValue] = useState("blue.6");
      return <ColorField value={value} onChange={setValue} />;
    }
    render(
      <MantineProvider>
        <ControlledField />
      </MantineProvider>,
    );

    expect(getPreviewColor()).toBe("rgb(34, 139, 230)");

    fireEvent.click(screen.getByRole("radio", { name: "Cyan" }));

    expect(getPreviewColor()).toBe("rgb(21, 170, 191)");
  });

  it("keeps showing the current color in the preview when disabled (ANA-106)", () => {
    renderField({ value: "teal.6", disabled: true });

    expect(getPreviewColor()).toBe("rgb(18, 184, 134)");
  });

  it("keeps two instances' values fully independent", () => {
    function TwoFields() {
      return (
        <MantineProvider>
          <ColorField label="Book color" value="blue.6" onChange={vi.fn()} />
          <ColorField label="Module color" value="teal.6" onChange={vi.fn()} />
        </MantineProvider>
      );
    }
    render(<TwoFields />);

    expect(screen.getByRole("combobox", { name: "Book color" })).toHaveValue(
      "blue.6",
    );
    expect(screen.getByRole("combobox", { name: "Module color" })).toHaveValue(
      "teal.6",
    );
  });
});
