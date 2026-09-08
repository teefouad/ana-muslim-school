import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LearningMaterialModuleCard } from "./learning-material-module-card";

function renderCard(
  overrides: Partial<
    React.ComponentProps<typeof LearningMaterialModuleCard>
  > = {},
) {
  const props: React.ComponentProps<typeof LearningMaterialModuleCard> = {
    testId: "module-card-0",
    index: 0,
    material: { ar: "", en: "" },
    onMaterialChange: vi.fn(),
    fontScale: 100,
    ...overrides,
  };

  render(
    <MantineProvider>
      <LearningMaterialModuleCard {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("LearningMaterialModuleCard", () => {
  it("labels the card with its 1-based Module index", () => {
    renderCard({ index: 2 });

    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("is expanded by default, showing the Markdown editor", async () => {
    renderCard();

    await screen.findByRole("toolbar");
  });

  it("collapses and re-expands when the title is clicked", async () => {
    renderCard();

    await screen.findByRole("toolbar");
    const title = screen.getByRole("button", { name: "Module 1" });

    fireEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    fireEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("exposes a drag handle, a delete affordance, a language switcher, an AI Assistant button, and the Markdown editor (ANA-75)", async () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: "Delete Module 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Arabic" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "English" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "AI Assistant" }),
    ).toBeInTheDocument();
    await screen.findByRole("toolbar");
  });

  it("defaults to showing the Arabic Learning Material draft", async () => {
    renderCard({ material: { ar: "محتوى عربي", en: "English content" } });

    await screen.findByText("محتوى عربي");
    expect(screen.queryByText("English content")).not.toBeInTheDocument();
  });

  it("switching languages preserves independent Arabic/English drafts (ANA-75)", async () => {
    renderCard({ material: { ar: "محتوى عربي", en: "English content" } });

    await screen.findByText("محتوى عربي");
    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(await screen.findByText("English content")).toBeInTheDocument();
    expect(screen.queryByText("محتوى عربي")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Arabic" }));

    expect(await screen.findByText("محتوى عربي")).toBeInTheDocument();
    expect(screen.queryByText("English content")).not.toBeInTheDocument();
  });

  it("reports an edit to the active language only, leaving the other untouched", async () => {
    const onMaterialChange = vi.fn();
    renderCard({
      material: { ar: "Existing Arabic", en: "Existing English" },
      onMaterialChange,
    });

    const editable = await screen.findByRole("textbox");
    const user = userEvent.setup();
    await user.click(editable);
    await user.type(editable, "!");

    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ar: "Existing Arabic!",
      en: "Existing English",
    });
  });

  it("uses RTL for Arabic and LTR for English, following the active language (not a global source direction)", async () => {
    renderCard({ material: { ar: "Arabic", en: "English" } });

    let editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "rtl");

    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });

  it("scales the editor's font size", () => {
    renderCard({ fontScale: 150 });

    const editorScale = screen.getByTestId("module-card-0-editor-scale");
    expect(editorScale).toHaveStyle({ fontSize: "21px" });
  });

  it("makes the editor read-only when disabled", async () => {
    renderCard({ material: { ar: "Existing notes", en: "" }, disabled: true });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "false");
  });

  it("leaves the editor editable by default", async () => {
    renderCard({ material: { ar: "Existing notes", en: "" } });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "true");
  });

  it("renders the delete affordance hidden at rest, revealed on header hover/focus-within", () => {
    renderCard();

    const deleteButton = screen.getByRole("button", {
      name: "Delete Module 1",
    });
    expect(deleteButton.className).toMatch(/deleteAction/);
  });

  it("clicking delete does not remove the card -- the affordance is not wired yet (ANA-75)", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

    expect(screen.getByText("Module 1")).toBeInTheDocument();
  });

  it("clicking delete or AI Assistant does not toggle the card's collapsed state", async () => {
    renderCard();
    await screen.findByRole("toolbar");

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("makes no network/AI request when AI Assistant is clicked (ANA-75)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  function gripElement(container: HTMLElement) {
    return container.querySelector(".lucide-grip-vertical")
      ?.parentElement as HTMLElement;
  }

  it("renders a decorative, non-interactive grip when not draggable (saved-Source workspace usage)", () => {
    const { container } = render(
      <MantineProvider>
        <LearningMaterialModuleCard
          testId="module-card-0"
          index={0}
          material={{ ar: "", en: "" }}
          onMaterialChange={vi.fn()}
          fontScale={100}
        />
      </MantineProvider>,
    );

    // No dnd-kit attributes/listeners are applied when `drag` is omitted --
    // the grip icon chrome is still present for visual consistency with
    // the Create-from-PDF card, but it isn't a real drag handle (ANA-75).
    const grip = gripElement(container);
    expect(grip).toHaveAttribute("aria-hidden", "true");
    // Not a grab cursor either -- a decorative grip must not imply an
    // interaction (reordering) that isn't actually available here (PR
    // review).
    expect(grip.className).not.toMatch(/gripDraggable/);
  });

  it("wires the grip as the real drag handle when `drag` is provided", () => {
    const attributes = { "aria-roledescription": "sortable" } as never;
    const listeners = { onPointerDown: vi.fn() } as never;
    const { container } = render(
      <MantineProvider>
        <LearningMaterialModuleCard
          testId="module-card-0"
          index={0}
          material={{ ar: "", en: "" }}
          onMaterialChange={vi.fn()}
          fontScale={100}
          drag={{
            attributes,
            listeners,
            setNodeRef: vi.fn(),
            style: {},
            isDragging: false,
          }}
        />
      </MantineProvider>,
    );

    const grip = gripElement(container);
    expect(grip).toHaveAttribute("aria-roledescription", "sortable");
    expect(grip).not.toHaveAttribute("aria-hidden");
    expect(grip.className).toMatch(/gripDraggable/);
  });
});
