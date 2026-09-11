import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@mantine/core";

import { TranslatableFieldHeader } from "./translatable-field-header";
import type { LanguageOption } from "./translatable-value";

const LANGUAGES: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const meta = {
  title: "UI/TranslatableFieldHeader",
  component: TranslatableFieldHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof TranslatableFieldHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledHeader() {
  const [activeSlug, setActiveSlug] = useState("ar");

  return (
    <div style={{ width: 420, paddingTop: 20 }}>
      <TranslatableFieldHeader
        label="Title"
        languages={LANGUAGES}
        activeSlug={activeSlug}
        onActiveSlugChange={setActiveSlug}
        isFilled={(slug) => slug === "ar"}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    label: "Title",
    languages: LANGUAGES,
    activeSlug: "ar",
    onActiveSlugChange: () => {},
    isFilled: () => false,
  },
  render: () => <ControlledHeader />,
};

export const WithActions: Story = {
  args: {
    label: "Description",
    languages: LANGUAGES,
    activeSlug: "ar",
    onActiveSlugChange: () => {},
    isFilled: () => true,
  },
  render: () => (
    <div style={{ width: 420, paddingTop: 20 }}>
      <TranslatableFieldHeader
        label="Description"
        languages={LANGUAGES}
        activeSlug="ar"
        onActiveSlugChange={() => {}}
        isFilled={() => true}
        actions={<Button size="xs">Translate</Button>}
      />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    label: "Title",
    languages: LANGUAGES,
    activeSlug: "ar",
    onActiveSlugChange: () => {},
    isFilled: () => false,
    disabled: true,
  },
  render: (args) => (
    <div style={{ width: 420, paddingTop: 20 }}>
      <TranslatableFieldHeader {...args} />
    </div>
  ),
};
