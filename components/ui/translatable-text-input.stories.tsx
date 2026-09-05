import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@mantine/core";

import { TranslatableTextInput } from "./translatable-text-input";
import type { LanguageOption, TranslatedValue } from "./translatable-value";

const LANGUAGES: LanguageOption[] = [
  { slug: "en", label: "English" },
  { slug: "ar", label: "Arabic" },
];

const meta = {
  title: "UI/TranslatableTextInput",
  component: TranslatableTextInput,
  tags: ["autodocs"],
} satisfies Meta<typeof TranslatableTextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledField(props: {
  initialValue?: TranslatedValue;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<TranslatedValue>(props.initialValue ?? {});
  return (
    <div style={{ width: 360 }}>
      <TranslatableTextInput
        label="Title"
        languages={LANGUAGES}
        value={value}
        onChange={setValue}
        placeholder="Enter a title…"
        disabled={props.disabled}
      />
    </div>
  );
}

export const Empty: Story = {
  args: { label: "Title", languages: LANGUAGES, value: {}, onChange: () => {} },
  render: () => <ControlledField />,
};

export const ArabicAndEnglishValues: Story = {
  args: { label: "Title", languages: LANGUAGES, value: {}, onChange: () => {} },
  render: () => (
    <ControlledField
      initialValue={{ ar: "الرحيق المختوم", en: "The Sealed Nectar" }}
    />
  ),
};

export const PartiallyFilled: Story = {
  args: { label: "Title", languages: LANGUAGES, value: {}, onChange: () => {} },
  render: () => <ControlledField initialValue={{ en: "The Sealed Nectar" }} />,
};

export const Disabled: Story = {
  args: { label: "Title", languages: LANGUAGES, value: {}, onChange: () => {} },
  render: () => (
    <ControlledField initialValue={{ en: "The Sealed Nectar" }} disabled />
  ),
};

export const WithActions: Story = {
  args: { label: "Title", languages: LANGUAGES, value: {}, onChange: () => {} },
  render: function Render() {
    const [value, setValue] = useState<TranslatedValue>({
      ar: "الرحيق المختوم",
    });
    return (
      <div style={{ width: 360 }}>
        <TranslatableTextInput
          label="Title"
          languages={LANGUAGES}
          value={value}
          onChange={setValue}
          placeholder="Enter a title…"
          actions={(activeSlug) =>
            activeSlug === "en" && (
              <Button variant="light" size="xs" radius="xl">
                Translate
              </Button>
            )
          }
        />
      </div>
    );
  },
};
