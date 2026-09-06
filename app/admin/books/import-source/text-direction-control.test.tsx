import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { TextDirectionControl } from "./text-direction-control";

function renderControl(
  props: React.ComponentProps<typeof TextDirectionControl>,
) {
  return render(
    <MantineProvider>
      <TextDirectionControl {...props} />
    </MantineProvider>,
  );
}

describe("TextDirectionControl", () => {
  it("marks the active direction as pressed", () => {
    renderControl({ value: "rtl", onChange: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Right to left" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Left to right" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked direction", () => {
    const onChange = vi.fn();
    renderControl({ value: "rtl", onChange });

    fireEvent.click(screen.getByRole("button", { name: "Left to right" }));

    expect(onChange).toHaveBeenCalledWith("ltr");
  });
});
