import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TempModule } from "./import-source-types";
import { LearningMaterialView } from "./learning-material-view";

const SAMPLE_MODULES: TempModule[] = [
  { id: "module-1", text: "First module source text" },
  { id: "module-2", text: "Second module source text" },
];

function renderView(
  overrides: Partial<React.ComponentProps<typeof LearningMaterialView>> = {},
) {
  const props: React.ComponentProps<typeof LearningMaterialView> = {
    fileName: "book.pdf",
    modules: SAMPLE_MODULES,
    learningMaterials: {},
    onLearningMaterialsChange: vi.fn(),
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    direction: "rtl",
    onDirectionChange: vi.fn(),
    onBack: vi.fn(),
    onFinish: vi.fn(),
    isFinishing: false,
    finishError: null,
    ...overrides,
  };

  render(
    <MantineProvider>
      <LearningMaterialView {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("LearningMaterialView", () => {
  it("shows the filename and the number of Modules created", () => {
    renderView();

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 modules created")).toBeInTheDocument();
  });

  it("uses singular copy for exactly one Module", () => {
    renderView({ modules: [SAMPLE_MODULES[0]] });

    expect(screen.getByText("1 module created")).toBeInTheDocument();
  });

  it("renders each Module in order, labeled Module 1, Module 2, ...", () => {
    renderView();

    const headers = screen.getAllByRole("button", { name: /^Module \d$/ });
    expect(headers.map((header) => header.textContent)).toEqual([
      "Module 1",
      "Module 2",
    ]);
  });

  it("renders each Module's source text read-only", () => {
    renderView();

    expect(screen.getByText("First module source text")).toBeInTheDocument();
    expect(screen.getByText("Second module source text")).toBeInTheDocument();
  });

  it("initializes each Module's Learning Material empty", async () => {
    renderView({ learningMaterials: {} });

    const editors = await screen.findAllByRole("textbox");
    expect(editors).toHaveLength(2);
    editors.forEach((editor) => expect(editor).toHaveTextContent(""));
  });

  it("merges an edit into the changed Module's id, leaving the others untouched", async () => {
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx's own tests, which only ever type onto existing content),
    // so this starts module-2 from non-empty content and appends --
    // matching that existing convention -- rather than exercising the
    // from-empty case here.
    const onLearningMaterialsChange = vi.fn();
    renderView({
      learningMaterials: { "module-1": "Keep me", "module-2": "Existing" },
      onLearningMaterialsChange,
    });

    const editors = await screen.findAllByRole("textbox");
    const user = userEvent.setup();
    await user.click(editors[1]);
    await user.type(editors[1], "!");

    expect(onLearningMaterialsChange).toHaveBeenLastCalledWith({
      "module-1": "Keep me",
      "module-2": "Existing!",
    });
  });

  it("an edit survives a Back -> Create Learning Material remount within the same session", async () => {
    // Mirrors how import-source-modal.tsx actually holds `learningMaterials`
    // -- as modal state that outlives this component being unmounted while
    // on the Module builder step and remounted when Create Learning
    // Material is clicked again. Seeded from non-empty content since
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx's own tests, which only ever type onto existing content).
    function Harness() {
      const [visible, setVisible] = useState(true);
      const [learningMaterials, setLearningMaterials] = useState<
        Record<string, string>
      >({ "module-1": "Existing" });

      if (!visible) {
        return (
          <button type="button" onClick={() => setVisible(true)}>
            Create Learning Material
          </button>
        );
      }

      return (
        <LearningMaterialView
          fileName="book.pdf"
          modules={SAMPLE_MODULES}
          learningMaterials={learningMaterials}
          onLearningMaterialsChange={setLearningMaterials}
          fontScale={100}
          onFontScaleChange={() => {}}
          direction="rtl"
          onDirectionChange={() => {}}
          onBack={() => setVisible(false)}
          onFinish={() => {}}
          isFinishing={false}
          finishError={null}
        />
      );
    }

    render(
      <MantineProvider>
        <Harness />
      </MantineProvider>,
    );

    const editors = await screen.findAllByRole("textbox");
    const user = userEvent.setup();
    await user.click(editors[0]);
    await user.type(editors[0], "!");
    await screen.findByText("Existing!");

    fireEvent.click(screen.getByRole("button", { name: "Back to Modules" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );

    expect(await screen.findByText("Existing!")).toBeInTheDocument();
  });

  it("Back to Modules calls onBack", () => {
    const onBack = vi.fn();
    renderView({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Back to Modules" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("disables Finish when there are no temporary Modules", () => {
    renderView({ modules: [] });

    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
  });

  it("enables Finish once there is at least one temporary Module", () => {
    renderView();

    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("disables Finish and shows a loading state while submitting", () => {
    renderView({ isFinishing: true });

    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
  });

  it("calls onFinish when Finish is clicked", () => {
    const onFinish = vi.fn();
    renderView({ onFinish });

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("shows a clear inline error when Module creation fails", () => {
    renderView({ finishError: "Could not create Module 2." });

    expect(screen.getByText("Could not create Module 2.")).toBeInTheDocument();
  });

  it("makes no network requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();

    await screen.findAllByRole("toolbar");

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
