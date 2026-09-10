import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockModule } from "./mock-modules";
import { ModulesPanel } from "./modules-panel";

const MODULES: MockModule[] = [
  { id: "module-1", title: "Introduction" },
  { id: "module-2", title: "" },
];

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ModulesPanel>> = {},
) {
  return render(
    <MantineProvider>
      <ModulesPanel
        modules={MODULES}
        onModulesChange={vi.fn()}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("ModulesPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("shows the Modules title and a pluralized module count subtitle", () => {
    renderPanel();

    expect(screen.getByText("Modules")).toBeInTheDocument();
    expect(screen.getByText("2 modules")).toBeInTheDocument();
  });

  it("uses the singular 'module' for a single module", () => {
    renderPanel({ modules: [MODULES[0]] });

    expect(screen.getByText("1 module")).toBeInTheDocument();
  });

  it("renders each module's title, falling back to Module N when blank", () => {
    renderPanel();

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Module 2")).toBeInTheDocument();
  });

  it("shows the empty-state copy when there are no modules", () => {
    renderPanel({ modules: [] });

    expect(
      screen.getByText("This book has no modules yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add module" })).toBeEnabled();
  });

  it("appends a new blank module through onModulesChange when Add module is clicked", () => {
    const onModulesChange = vi.fn();
    renderPanel({ onModulesChange });

    fireEvent.click(screen.getByRole("button", { name: "Add module" }));

    expect(onModulesChange).toHaveBeenCalledWith([
      ...MODULES,
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
      screen.getByRole("button", { name: "Edit Module 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Module 2" }),
    ).toBeInTheDocument();
  });

  it("removes the module through onModulesChange when its delete action is clicked", () => {
    const onModulesChange = vi.fn();
    renderPanel({ onModulesChange });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Introduction" }),
    );

    expect(onModulesChange).toHaveBeenCalledWith([MODULES[1]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call onModulesChange or make a network/Module request when a module's edit action is clicked", () => {
    const onModulesChange = vi.fn();
    renderPanel({ onModulesChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit Introduction" }));

    expect(onModulesChange).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls onEditModule with the clicked module when provided (ANA-91)", () => {
    const onEditModule = vi.fn();
    const onModulesChange = vi.fn();
    renderPanel({ onEditModule, onModulesChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit Introduction" }));

    expect(onEditModule).toHaveBeenCalledWith(MODULES[0]);
    expect(onModulesChange).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables Add module, reordering, and the edit/delete actions when disabled", () => {
    renderPanel({ disabled: true });

    expect(screen.getByRole("button", { name: "Add module" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit Introduction" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete Introduction" }),
    ).toBeDisabled();
    const grip = document.querySelector(
      '[data-testid="list-item-module-1"] [aria-hidden="true"]',
    );
    expect(grip).toBeInTheDocument();
    expect(grip).not.toHaveAttribute("tabindex");
  });

  it("makes no network call or browser persistence when adding or deleting a module", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add module" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Introduction" }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  describe("onDeleteModule (Edit Book's persisted Modules, ANA-77)", () => {
    it("shows a confirmation dialog instead of deleting immediately", () => {
      const onDeleteModule = vi.fn();
      const onModulesChange = vi.fn();
      renderPanel({ onDeleteModule, onModulesChange });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Delete module?" }),
      ).toBeInTheDocument();
      expect(onDeleteModule).not.toHaveBeenCalled();
      expect(onModulesChange).not.toHaveBeenCalled();
    });

    it("calls onDeleteModule (not onModulesChange) once confirmed", async () => {
      const onDeleteModule = vi.fn().mockResolvedValue(undefined);
      const onModulesChange = vi.fn();
      renderPanel({ onDeleteModule, onModulesChange });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() =>
        expect(onDeleteModule).toHaveBeenCalledWith(MODULES[0]),
      );
      expect(onModulesChange).not.toHaveBeenCalled();
    });

    it("makes no call when canceled", () => {
      const onDeleteModule = vi.fn();
      renderPanel({ onDeleteModule });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onDeleteModule).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Delete module?" }),
      ).not.toBeInTheDocument();
    });

    it("keeps the row and shows an error when the delete request fails", async () => {
      const onDeleteModule = vi
        .fn()
        .mockRejectedValue(new Error("Module still has Lessons."));
      renderPanel({ onDeleteModule });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      expect(
        await screen.findByText("Module still has Lessons."),
      ).toBeInTheDocument();
      expect(screen.getByText("Introduction")).toBeInTheDocument();
    });
  });
});
