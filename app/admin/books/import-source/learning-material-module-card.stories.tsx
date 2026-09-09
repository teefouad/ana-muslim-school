import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  LearningMaterialModuleCard,
  type LearningMaterialModuleCardProps,
} from "./learning-material-module-card";

function LearningMaterialModuleCardDemo(
  props: LearningMaterialModuleCardProps,
) {
  const [material, setMaterial] = useState(props.material);

  return (
    <LearningMaterialModuleCard
      {...props}
      material={material}
      onMaterialChange={setMaterial}
    />
  );
}

const meta = {
  title: "Books/ImportSource/LearningMaterialModuleCard",
  component: LearningMaterialModuleCard,
  tags: ["autodocs"],
  args: {
    testId: "module-card-0",
    index: 0,
    material: { ar: "", en: "" },
    onMaterialChange: () => {},
    fontScale: 100,
  },
  render: (args) => (
    <div style={{ width: 720 }}>
      <LearningMaterialModuleCardDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LearningMaterialModuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// The shared Module-card shell used in both the Create-from-PDF Learning
// Material step and the saved-Source ("View source text") workspace
// (ANA-75) -- same header (drag handle, title, delete affordance, language
// switcher, AI Assistant) and body (the School MarkdownEditor) in both
// places, so they can never independently drift apart again.
export const Empty: Story = {};

export const WithLearningMaterial: Story = {
  args: {
    material: { ar: "## الدرس\n\nملخص الدرس هنا.", en: "" },
  },
};

// Switching the language switcher to English shows the English draft, kept
// entirely independent from the Arabic one (ANA-75) -- both survive a
// language switch, unlike the single-string editor this replaced.
export const BilingualContent: Story = {
  args: {
    material: {
      ar: "## الدرس\n\nملخص الدرس هنا.",
      en: "## Lesson\n\nThe lesson summary goes here.",
    },
  },
};

export const Disabled: Story = {
  args: {
    material: { ar: "Frozen while Save Changes is in flight.", en: "" },
    disabled: true,
  },
};

// Delete, Translate, and AI Assistant wired up (ANA-77/ANA-85): Delete opens
// this card's own confirmation dialog before calling `onDelete`; Translate
// is enabled since the Arabic draft is non-empty, and English is empty so it
// would translate immediately without a replace-confirmation; AI Assistant
// operates on the editor's current selection and starts disabled until text
// is selected in it (PR review).
export const WithActions: Story = {
  args: {
    material: { ar: "## الدرس\n\nملخص الدرس هنا.", en: "" },
    onDelete: () => {},
    onTranslate: async () => {},
    onAiAssist: async () => {},
  },
};

// Select some text in the editor to enable AI Assistant, then click it --
// opens a dialog with an optional instructions textarea; Generate closes it
// and calls `onAiAssist` with the active language, the trimmed instructions,
// the exact selected Markdown, and a token marking its place (ANA-85, PR
// review).
export const AiAssistant: Story = {
  args: {
    material: { ar: "## الدرس\n\nملخص الدرس هنا.", en: "" },
    onAiAssist: async () => {},
  },
};

// Non-empty English content makes Translate destructive -- clicking it
// opens a "Replace English translation?" confirmation before calling
// `onTranslate` (ANA-77).
export const TranslateReplacesExistingEnglish: Story = {
  args: {
    material: {
      ar: "## الدرس\n\nملخص الدرس هنا.",
      en: "## Lesson\n\nThe lesson summary goes here.",
    },
    onTranslate: async () => {},
  },
};

export const TranslateDisabledForEmptyArabic: Story = {
  args: {
    material: { ar: "", en: "" },
    onTranslate: async () => {},
  },
};

// A temporary, unsaved Module (Create-from-PDF, or a not-yet-saved View
// source text entry) gets different delete-confirmation copy (ANA-77).
export const TemporaryModuleDeleteConfirmation: Story = {
  args: {
    material: { ar: "Not yet saved.", en: "" },
    onDelete: () => {},
    deleteConfirmDescription:
      "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.",
  },
};
