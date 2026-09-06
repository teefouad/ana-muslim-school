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

  it("exposes edit and delete icon actions on every row via ItemList", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Edit Introduction" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Introduction" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Section 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Section 2" }),
    ).toBeInTheDocument();
  });

  it("removes the section through onSectionsChange when its delete action is clicked", () => {
    const onSectionsChange = vi.fn();
    renderPanel({ onSectionsChange });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Introduction" }),
    );

    expect(onSectionsChange).toHaveBeenCalledWith([SECTIONS[1]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call onSectionsChange or make a network/Module request when a section's edit action is clicked", () => {
    const onSectionsChange = vi.fn();
    renderPanel({ onSectionsChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit Introduction" }));

    expect(onSectionsChange).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables Add section, reordering, and the edit/delete actions when disabled", () => {
    renderPanel({ disabled: true });

    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit Introduction" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete Introduction" }),
    ).toBeDisabled();
    const grip = document.querySelector(
      '[data-testid="list-item-section-1"] [aria-hidden="true"]',
    );
    expect(grip).toBeInTheDocument();
    expect(grip).not.toHaveAttribute("tabindex");
  });

  it("makes no network call or browser persistence when adding or deleting a section", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Introduction" }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});
