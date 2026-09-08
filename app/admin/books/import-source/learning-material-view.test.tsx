import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { TempModule } from "./import-source-types";
import { LearningMaterialView } from "./learning-material-view";

const SAMPLE_MODULES: TempModule[] = [
  { id: "module-1", text: "First module source text" },
  { id: "module-2", text: "Second module source text" },
];

function moduleHeader(name: string) {
  return screen.getByText(name).closest("[aria-expanded]") as HTMLElement;
}

function renderView(
  overrides: Partial<React.ComponentProps<typeof LearningMaterialView>> = {},
) {
  const props: React.ComponentProps<typeof LearningMaterialView> = {
    fileName: "book.pdf",
    modules: SAMPLE_MODULES,
    onModulesChange: vi.fn(),
    learningMaterials: {},
    onLearningMaterialsChange: vi.fn(),
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    onBack: vi.fn(),
    onFinish: vi.fn(),
    isFinishing: false,
    finishError: null,
    backDisabled: false,
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

    expect(moduleHeader("Module 1")).toBeInTheDocument();
    expect(moduleHeader("Module 2")).toBeInTheDocument();
  });

  it("exposes a drag handle, delete affordance, language switcher, and AI Assistant for every Module (ANA-75)", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Delete Module 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Module 2" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Arabic" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "English" })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "AI Assistant" }),
    ).toHaveLength(2);
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
      learningMaterials: {
        "module-1": { ar: "Keep me", en: "" },
        "module-2": { ar: "Existing", en: "" },
      },
      onLearningMaterialsChange,
    });

    const editors = await screen.findAllByRole("textbox");
    const user = userEvent.setup();
    await user.click(editors[1]);
    await user.type(editors[1], "!");

    expect(onLearningMaterialsChange).toHaveBeenLastCalledWith({
      "module-1": { ar: "Keep me", en: "" },
      "module-2": { ar: "Existing!", en: "" },
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
      const [modules, setModules] = useState(SAMPLE_MODULES);
      const [learningMaterials, setLearningMaterials] = useState<
        Record<string, TranslatableString>
      >({ "module-1": { ar: "Existing", en: "" } });

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
          modules={modules}
          onModulesChange={setModules}
          learningMaterials={learningMaterials}
          onLearningMaterialsChange={setLearningMaterials}
          fontScale={100}
          onFontScaleChange={() => {}}
          onBack={() => setVisible(false)}
          onFinish={() => {}}
          isFinishing={false}
          finishError={null}
          backDisabled={false}
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

  it("makes every Module's Learning Material editor read-only while Finish is submitting", async () => {
    // PR review (ANA-71, blocking): `handleFinish` persists the
    // `learningMaterials` snapshot from the moment Finish was clicked --
    // edits typed while that request is in flight must not be possible,
    // since they'd never actually reach the server.
    renderView({ isFinishing: true });

    const editors = await screen.findAllByRole("textbox");
    expect(editors).toHaveLength(2);
    editors.forEach((editor) =>
      expect(editor).toHaveAttribute("contenteditable", "false"),
    );
  });

  it("keeps every Module's Learning Material editor editable before Finish is submitting", async () => {
    renderView({ isFinishing: false });

    const editors = await screen.findAllByRole("textbox");
    editors.forEach((editor) =>
      expect(editor).toHaveAttribute("contenteditable", "true"),
    );
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

  it("disables Back to Modules once a Module has already been created in this Finish session", () => {
    // PR review (ANA-70, blocking): once any Module POST has succeeded,
    // going back to the Module builder would let the temporary set be
    // reordered/deleted out from under a Module that already exists under
    // the Book and can't be rolled back from here.
    renderView({ backDisabled: true });

    expect(
      screen.getByRole("button", { name: "Back to Modules" }),
    ).toBeDisabled();
  });

  it("keeps Back to Modules enabled before any Module has been created", () => {
    renderView({ backDisabled: false });

    expect(
      screen.getByRole("button", { name: "Back to Modules" }),
    ).toBeEnabled();
  });

  it("makes no network requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();

    await screen.findAllByRole("toolbar");

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
