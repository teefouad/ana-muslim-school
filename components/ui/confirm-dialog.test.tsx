import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) {
  const props: React.ComponentProps<typeof ConfirmDialog> = {
    opened: true,
    title: "Discard unsaved changes?",
    description: "Your changes have not been saved and will be lost.",
    confirmLabel: "Discard changes",
    cancelLabel: "Keep editing",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };

  render(
    <MantineProvider>
      <ConfirmDialog {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("ConfirmDialog", () => {
  it("renders the given title and description", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your changes have not been saved and will be lost."),
    ).toBeInTheDocument();
  });

  it("renders nothing when not opened", () => {
    renderDialog({ opened: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state on the confirm button while confirming", () => {
    renderDialog({ isConfirming: true });

    const confirmButton = screen.getByRole("button", {
      name: "Discard changes",
    });
    expect(confirmButton).toHaveAttribute("data-loading", "true");
  });

  it("forwards a supplied zIndex to the underlying Modal", () => {
    renderDialog({ zIndex: 300 });

    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    expect(
      dialog.closest(".mantine-Modal-root")?.getAttribute("style"),
    ).toContain("--mb-z-index: 300");
  });

  it("disables the cancel button and blocks Escape while confirming", () => {
    const onCancel = vi.fn();
    renderDialog({ isConfirming: true, onCancel });

    expect(screen.getByRole("button", { name: "Keep editing" })).toBeDisabled();

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });
});
