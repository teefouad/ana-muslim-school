import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { FontSizeControl } from "./font-size-control";

function renderControl(props: React.ComponentProps<typeof FontSizeControl>) {
  return render(
    <MantineProvider>
      <FontSizeControl {...props} />
    </MantineProvider>,
  );
}

describe("FontSizeControl", () => {
  it("shows the current value and steps by 25% within 75-200%", () => {
    const onChange = vi.fn();
    renderControl({ value: 100, onChange });

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(onChange).toHaveBeenCalledWith(125);

    fireEvent.click(screen.getByRole("button", { name: "Decrease font size" }));
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it("disables Decrease at the 75% minimum", () => {
    renderControl({ value: 75, onChange: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Decrease font size" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase font size" }),
    ).toBeEnabled();
  });

  it("disables Increase at the 200% maximum", () => {
    renderControl({ value: 200, onChange: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Increase font size" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decrease font size" }),
    ).toBeEnabled();
  });
});
