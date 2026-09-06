import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockSection } from "./mock-sections";
import { SectionsPanel } from "./sections-panel";

const SECTIONS: MockSection[] = [
  { id: "section-1", title: "Introduction" },
  { id: "section-2", title: "" },
];

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof SectionsPanel>> = {},
) {
  return render(
    <MantineProvider>
      <SectionsPanel
        sections={SECTIONS}
        onSectionsChange={vi.fn()}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("SectionsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("shows the Sections title and a pluralized section count subtitle", () => {
    renderPanel();

    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByText("2 sections")).toBeInTheDocument();
  });

  it("uses the singular 'section' for a single section", () => {
    renderPanel({ sections: [SECTIONS[0]] });

    expect(screen.getByText("1 section")).toBeInTheDocument();
  });

  it("renders each section's title, falling back to Section N when blank", () => {
    renderPanel();

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Section 2")).toBeInTheDocument();
  });

  it("shows the empty-state copy when there are no sections", () => {
    renderPanel({ sections: [] });

    expect(
      screen.getByText("This book has no sections yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add section" })).toBeEnabled();
  });

  it("appends a new blank section through onSectionsChange when Add section is clicked", () => {
    const onSectionsChange = vi.fn();
    renderPanel({ onSectionsChange });

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    expect(onSectionsChange).toHaveBeenCalledWith([
      ...SECTIONS,
      expect.objectContaining({ title: "" }),
    ]);
  });

  it("disables Add section and reordering when disabled", () => {
    renderPanel({ disabled: true });

    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
    const grip = document.querySelector(
      '[data-testid="list-item-section-1"] [aria-hidden="true"]',
    );
    expect(grip).toBeInTheDocument();
    expect(grip).not.toHaveAttribute("tabindex");
  });

  it("makes no network call or browser persistence when adding a section", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});
