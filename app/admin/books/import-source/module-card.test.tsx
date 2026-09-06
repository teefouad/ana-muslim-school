import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { describe, expect, it, vi } from "vitest";

import type { TempModule } from "./import-source-types";
import { ModuleCard } from "./module-card";

function renderCard(
  module: TempModule = { id: "module-1", text: "Selected text" },
  index = 0,
  onTextChange = vi.fn(),
) {
  render(
    <MantineProvider>
      <DndContext>
        <SortableContext items={[module.id]}>
          <ul>
            <ModuleCard
              module={module}
              index={index}
              onTextChange={onTextChange}
            />
          </ul>
        </SortableContext>
      </DndContext>
    </MantineProvider>,
  );
  return onTextChange;
}

describe("ModuleCard", () => {
  it("is expanded by default, showing its editable text", () => {
    renderCard();

    expect(screen.getByLabelText("Module 1 text")).toHaveValue("Selected text");
  });

  it("labels itself by its 1-based order", () => {
    renderCard({ id: "module-1", text: "x" }, 2);

    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("collapses and expands when its header is clicked", () => {
    renderCard();

    fireEvent.click(screen.getByText("Module 1"));
    expect(screen.queryByLabelText("Module 1 text")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Module 1"));
    expect(screen.getByLabelText("Module 1 text")).toBeInTheDocument();
  });

  it("toggles on Enter", () => {
    renderCard();
    const header = screen.getByText("Module 1").closest("[aria-expanded]")!;

    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.queryByLabelText("Module 1 text")).not.toBeInTheDocument();
  });

  it("calls onTextChange when the textarea is edited, without collapsing", () => {
    const onTextChange = renderCard();

    fireEvent.change(screen.getByLabelText("Module 1 text"), {
      target: { value: "New text" },
    });

    expect(onTextChange).toHaveBeenCalledWith("New text");
    expect(screen.getByLabelText("Module 1 text")).toBeInTheDocument();
  });
});
