import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormField } from "./form-field";
import type { TranslatedValue } from "./translatable-value";

const meta = {
  title: "UI/FormField",
  component: FormField,
  tags: ["autodocs"],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

async function fakeTranslate({ text }: { text: string }) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return `${text} (translated)`;
}

async function fakeAssist({
  text,
  instructions,
}: {
  text: string;
  instructions?: string;
}) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return instructions
    ? `${text} (refined: ${instructions})`
    : `${text} (refined)`;
}

function PlainText() {
  const [value, setValue] = useState("");
  return (
    <div style={{ width: 480 }}>
      <FormField label="Title" value={value} onChange={setValue} />
    </div>
  );
}

function PlainTextarea() {
  const [value, setValue] = useState("");
  return (
    <div style={{ width: 480 }}>
      <FormField
        label="Description"
        type="textarea"
        value={value}
        onChange={setValue}
        textareaProps={{ autosize: true, minRows: 3, maxRows: 8 }}
      />
    </div>
  );
}

function TranslatableText() {
  const [value, setValue] = useState<TranslatedValue>({
    ar: "المقدمة",
    en: "",
  });
  return (
    <div style={{ width: 480 }}>
      <FormField
        label="Title"
        translatable
        value={value}
        onChange={setValue}
        aiTranslation
        onAiTranslate={fakeTranslate}
      />
    </div>
  );
}

function TranslatableWithBothAiActions() {
  const [value, setValue] = useState<TranslatedValue>({
    ar: "وصف الوحدة",
    en: "",
  });
  return (
    <div style={{ width: 480 }}>
      <FormField
        label="Description"
        translatable
        value={value}
        onChange={setValue}
        aiTranslation
        onAiTranslate={fakeTranslate}
        aiAssistance
        onAiAssist={fakeAssist}
        getAIAssistanceContext={() => ({ bookId: "book-1" })}
      />
    </div>
  );
}

function MarkdownField() {
  const [value, setValue] = useState<TranslatedValue>({
    ar: "# محتوى\n\nنص تجريبي.",
    en: "",
  });
  return (
    <div style={{ width: 560 }}>
      <FormField
        label="Content"
        type="markdown"
        translatable
        value={value}
        onChange={setValue}
        aiAssistance
        onAiAssist={fakeAssist}
      />
    </div>
  );
}

export const PlainTextField: Story = {
  args: { label: "Title", value: "", onChange: () => {} },
  render: () => <PlainText />,
};

export const PlainTextareaField: Story = {
  args: {
    label: "Description",
    type: "textarea",
    value: "",
    onChange: () => {},
  },
  render: () => <PlainTextarea />,
};

export const TranslatableWithTranslate: Story = {
  args: { label: "Title", translatable: true, value: {}, onChange: () => {} },
  render: () => <TranslatableText />,
};

export const TranslatableWithTranslateAndAssist: Story = {
  args: {
    label: "Description",
    translatable: true,
    value: {},
    onChange: () => {},
  },
  render: () => <TranslatableWithBothAiActions />,
};

export const MarkdownWithAiAssistance: Story = {
  args: {
    label: "Content",
    type: "markdown",
    translatable: true,
    value: {},
    onChange: () => {},
  },
  render: () => <MarkdownField />,
};

export const Disabled: Story = {
  args: {
    label: "Title",
    translatable: true,
    value: { ar: "المقدمة", en: "Introduction" },
    onChange: () => {},
    aiTranslation: true,
    disabled: true,
  },
};
