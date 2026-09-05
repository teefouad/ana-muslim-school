import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { ToggleCard, type ToggleCardProps } from "./toggle-card";

function renderCard(overrides: Partial<ToggleCardProps> = {}) {
  return render(
    <MantineProvider>
      <ToggleCard
        label="Published"
        checked={false}
        onChange={() => {}}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("ToggleCard", () => {
  test("renders the label and description", () => {
    renderCard({ description: "Visible to readers in the app." });

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(
      screen.getByText("Visible to readers in the app."),
    ).toBeInTheDocument();
  });

  test("renders without a description", () => {
    renderCard();

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  test("exposes the label as the switch's accessible name", () => {
    renderCard({ label: "Published" });
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
  });

  test("reflects the checked prop via aria-checked", () => {
    const { rerender } = renderCard({ checked: false });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    rerender(
      <MantineProvider>
        <ToggleCard label="Published" checked onChange={() => {}} />
      </MantineProvider>,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  test("clicking the card toggles exactly once", () => {
    const onChange = vi.fn();
    renderCard({ checked: false, onChange });

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("clicking the visible switch inside the card still only toggles once", () => {
    const onChange = vi.fn();
    renderCard({ checked: false, onChange });

    const input = document.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    fireEvent.click(input!);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("is keyboard accessible via Enter and Space", () => {
    const onChange = vi.fn();
    renderCard({ checked: false, onChange });

    const card = screen.getByRole("switch");
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test("is focusable via tab order when enabled", () => {
    renderCard();
    expect(screen.getByRole("switch")).toHaveAttribute("tabIndex", "0");
  });

  test("disabled prevents click and keyboard toggling and removes it from tab order", () => {
    const onChange = vi.fn();
    renderCard({ disabled: true, onChange });

    const card = screen.getByRole("switch");
    expect(card).toHaveAttribute("tabIndex", "-1");
    expect(card).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  test("primary and error variants render distinct visual states when checked", () => {
    const { rerender } = renderCard({ checked: true, variant: "primary" });
    const primaryClassName = screen.getByRole("switch").className;

    rerender(
      <MantineProvider>
        <ToggleCard
          label="Published"
          checked
          variant="error"
          onChange={() => {}}
        />
      </MantineProvider>,
    );
    const errorClassName = screen.getByRole("switch").className;

    expect(primaryClassName).not.toBe(errorClassName);
  });
});
