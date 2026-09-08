import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { WorkspaceModuleEntry } from "./import-source-types";
import {
  SavedSourceView,
  type SavedSourceViewProps,
} from "./saved-source-view";

function SavedSourceViewDemo(props: SavedSourceViewProps) {
  const [content, setContent] = useState(props.content);
  const [entries, setEntries] = useState(props.entries);
  const [fontScale, setFontScale] = useState(props.fontScale);
  const [direction, setDirection] = useState(props.direction);

  return (
    <SavedSourceView
      {...props}
      content={content}
      onContentChange={setContent}
      entries={entries}
      onEntriesChange={setEntries}
      fontScale={fontScale}
      onFontScaleChange={setFontScale}
      direction={direction}
      onDirectionChange={setDirection}
    />
  );
}

const SAMPLE_ENTRIES: WorkspaceModuleEntry[] = [
  {
    key: "module-1",
    moduleId: "module-1",
    material: { ar: "# الدرس الأول\n\nمحتوى تعليمي للدرس الأول.", en: "" },
  },
  { key: "module-2", moduleId: "module-2", material: { ar: "", en: "" } },
];

const meta = {
  title: "Books/ImportSource/SavedSourceView",
  component: SavedSourceView,
  tags: ["autodocs"],
  args: {
    bookId: "book-1",
    content:
      "# الفصل الأول\n\nنص الصفحة الأولى الذي تم استخراجه ومراجعته.\n\n# الفصل الثاني\n\nنص الصفحة الثانية.",
    onContentChange: () => {},
    entries: SAMPLE_ENTRIES,
    onEntriesChange: () => {},
    onRemove: () => {},
    isRemoving: false,
    removeError: null,
    onSave: () => {},
    isSaving: false,
    saveError: null,
    fontScale: 100,
    direction: "rtl" as const,
    onFontScaleChange: () => {},
    onDirectionChange: () => {},
  },
  render: (args) => (
    <div style={{ height: "80vh", display: "flex" }}>
      <SavedSourceViewDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof SavedSourceView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoModulesYet: Story = {
  args: { entries: [] },
};

export const Removing: Story = {
  args: { isRemoving: true },
};

export const RemoveFailed: Story = {
  args: { removeError: "Could not remove the source. Please try again." },
};

export const Saving: Story = {
  args: { isSaving: true },
};

export const SaveFailed: Story = {
  args: { saveError: "Could not save the changes. Please try again." },
};
