import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionIconButton } from "./action-icon-button";

function renderButton(
  overrides: Partial<React.ComponentProps<typeof ActionIconButton>> = {},
) {
  const props: React.ComponentProps<typeof ActionIconButton> = {
    "aria-label": "AI Assistance",
    onClick: vi.fn(),
    children: <span>icon</span>,
    ...overrides,
  };

  render(
    <MantineProvider>
      <ActionIconButton {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("ActionIconButton", () => {
  it("renders as a button with the given accessible label", () => {
    renderButton();

    expect(
      screen.getByRole("button", { name: "AI Assistance" }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    renderButton({ onClick });

    fireEvent.click(screen.getByRole("button", { name: "AI Assistance" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not call onClick when disabled", () => {
    const onClick = vi.fn();
    renderButton({ onClick, disabled: true });

    const button = screen.getByRole("button", { name: "AI Assistance" });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a loading state", () => {
    renderButton({ loading: true });

    expect(
      screen.getByRole("button", { name: "AI Assistance" }),
    ).toHaveAttribute("data-loading", "true");
  });

  it("defaults to the subtle variant, overridable per call site", () => {
    renderButton({ variant: "filled" });

    expect(
      screen.getByRole("button", { name: "AI Assistance" }),
    ).toHaveAttribute("data-variant", "filled");
  });
});
