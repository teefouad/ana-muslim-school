import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedSourceView } from "./saved-source-view";

function renderView(
  overrides: Partial<React.ComponentProps<typeof SavedSourceView>> = {},
) {
  const props: React.ComponentProps<typeof SavedSourceView> = {
    content: "Saved source text",
    onRemove: vi.fn(),
    isRemoving: false,
    removeError: null,
    ...overrides,
  };

  render(
    <MantineProvider>
      <SavedSourceView {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("SavedSourceView", () => {
  it("displays the complete stored content", () => {
    renderView({ content: "Line one\n\nLine two" });

    expect(screen.getByLabelText("Saved source text")).toHaveValue(
      "Line one\n\nLine two",
    );
  });

  it("renders the content read-only", () => {
    renderView();

    expect(screen.getByLabelText("Saved source text")).toHaveAttribute(
      "readonly",
    );
  });

  it("calls onRemove when Remove source text is clicked", () => {
    const onRemove = vi.fn();
    renderView({ onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Remove source text" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables the Remove button and shows a loading state while removing", () => {
    renderView({ isRemoving: true });

    expect(
      screen.getByRole("button", { name: "Remove source text" }),
    ).toBeDisabled();
  });

  it("shows a removal error while keeping the saved Source visible", () => {
    renderView({ removeError: "Could not remove the source." });

    expect(
      screen.getByText("Could not remove the source."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Saved source text")).toBeInTheDocument();
  });

  it("makes no network requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
