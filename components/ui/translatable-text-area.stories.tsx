import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TranslatableTextArea } from "./translatable-text-area";
import type { LanguageOption, TranslatedValue } from "./translatable-value";

const LANGUAGES: LanguageOption[] = [
  { slug: "en", label: "English" },
  { slug: "ar", label: "Arabic" },
];

const meta = {
  title: "UI/TranslatableTextArea",
  component: TranslatableTextArea,
  tags: ["autodocs"],
} satisfies Meta<typeof TranslatableTextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledField(props: {
  initialValue?: TranslatedValue;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<TranslatedValue>(props.initialValue ?? {});
  return (
    <div style={{ width: 520 }}>
      <TranslatableTextArea
        label="Description"
        languages={LANGUAGES}
        value={value}
        onChange={setValue}
        placeholder="Enter a description…"
        disabled={props.disabled}
      />
    </div>
  );
}

export const Empty: Story = {
  args: {
    label: "Description",
    languages: LANGUAGES,
    value: {},
    onChange: () => {},
  },
  render: () => <ControlledField />,
};

export const ArabicAndEnglishValues: Story = {
  args: {
    label: "Description",
    languages: LANGUAGES,
    value: {},
    onChange: () => {},
  },
  render: () => (
    <ControlledField
      initialValue={{
        en: "# The Sealed Nectar\n\nA **biography** of the Prophet Muhammad.",
        ar: "# الرحيق المختوم\n\n**سيرة** النبي محمد صلى الله عليه وسلم.",
      }}
    />
  ),
};

export const PartiallyFilled: Story = {
  args: {
    label: "Description",
    languages: LANGUAGES,
    value: {},
    onChange: () => {},
  },
  render: () => (
    <ControlledField initialValue={{ en: "# The Sealed Nectar" }} />
  ),
};

export const Disabled: Story = {
  args: {
    label: "Description",
    languages: LANGUAGES,
    value: {},
    onChange: () => {},
  },
  render: () => (
    <ControlledField initialValue={{ en: "# The Sealed Nectar" }} disabled />
  ),
};
