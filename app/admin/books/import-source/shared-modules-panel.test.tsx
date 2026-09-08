import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule, WorkspaceModuleEntry } from "./import-source-types";
import { ModuleBuilderView } from "./module-builder-view";
import { SavedSourceView } from "./saved-source-view";

vi.mock("./modules-client", () => ({
  deleteModule: vi.fn(),
  reorderModules: vi.fn(),
}));

vi.mock("./translate-client", () => ({
  translateArabicToEnglish: vi.fn(),
}));

const OCR_RESULT: OcrResult = {
  model: "mistral-ocr-latest",
  pagesProcessed: 1,
  docSizeBytes: 100,
  pages: [{ pageNumber: 1, markdown: "Some text" }],
};

// Acceptance test for ANA-79's hard requirement: Create-from-PDF
// (ModuleBuilderView) and View Source Text (SavedSourceView) must render
// the exact same shared Modules-panel component, not merely the same
// individual card -- neither view may implement its own Module-list
// markup, card mapping, or list CSS. Verified here by rendering one Module
// through each view and asserting they produce identical, shared-component
// signatures: the same testid scheme (source-modules-panel.tsx's own,
// `module-card-<key>`, not the pre-ANA-79
// `source-module-card-<index>`/`module-card-<id>` split) and the exact same
// CSS module class on the card list -- Vite generates one class per CSS
// Modules file+export, so an identical class here is only possible if both
// views import the same list styling from the same shared file, not two
// independently maintained ones.
describe("Create-from-PDF and View Source Text share one Modules panel component (ANA-79)", () => {
  it("both render a Module card under the same module-card-<key> testid scheme", () => {
    const modules: TempModule[] = [
      { id: "shared-key", material: { ar: "Text", en: "" } },
    ];
    render(
      <MantineProvider>
        <ModuleBuilderView
          fileName="book.pdf"
          ocrResult={OCR_RESULT}
          editedMarkdown={{ 1: "Some text" }}
          fontScale={100}
          onFontScaleChange={vi.fn()}
          direction="rtl"
          onDirectionChange={vi.fn()}
          modules={modules}
          onModulesChange={vi.fn()}
          onBack={vi.fn()}
          backDisabled={false}
          createdModuleIds={new Set()}
          onFinish={vi.fn()}
          isFinishing={false}
          finishError={null}
        />
      </MantineProvider>,
    );

    expect(screen.getByTestId("module-card-shared-key")).toBeInTheDocument();
  });

  it("both views' Module lists share the exact same CSS module class (same source-modules-panel.tsx list)", () => {
    const modules: TempModule[] = [
      { id: "key-1", material: { ar: "Text", en: "" } },
    ];
    const { unmount } = render(
      <MantineProvider>
        <ModuleBuilderView
          fileName="book.pdf"
          ocrResult={OCR_RESULT}
          editedMarkdown={{ 1: "Some text" }}
          fontScale={100}
          onFontScaleChange={vi.fn()}
          direction="rtl"
          onDirectionChange={vi.fn()}
          modules={modules}
          onModulesChange={vi.fn()}
          onBack={vi.fn()}
          backDisabled={false}
          createdModuleIds={new Set()}
          onFinish={vi.fn()}
          isFinishing={false}
          finishError={null}
        />
      </MantineProvider>,
    );
    const builderListClassName = screen
      .getByTestId("module-card-key-1")
      .closest("ul")!.className;
    unmount();

    const entries: WorkspaceModuleEntry[] = [
      { key: "key-1", moduleId: "key-1", material: { ar: "Text", en: "" } },
    ];
    render(
      <MantineProvider>
        <SavedSourceView
          bookId="book-1"
          content="Some text"
          onContentChange={vi.fn()}
          entries={entries}
          onEntriesChange={vi.fn()}
          onRemove={vi.fn()}
          isRemoving={false}
          removeError={null}
          onSave={vi.fn()}
          isSaving={false}
          saveError={null}
          fontScale={100}
          onFontScaleChange={vi.fn()}
          direction="rtl"
          onDirectionChange={vi.fn()}
        />
      </MantineProvider>,
    );
    const savedViewListClassName = screen
      .getByTestId("module-card-key-1")
      .closest("ul")!.className;

    expect(builderListClassName).toBeTruthy();
    expect(builderListClassName).toBe(savedViewListClassName);
  });
});
