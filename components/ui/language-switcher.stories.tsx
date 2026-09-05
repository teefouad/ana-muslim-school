import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LanguageSwitcher } from "./language-switcher";

const LANGUAGES = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const meta = {
  title: "UI/LanguageSwitcher",
  component: LanguageSwitcher,
  tags: ["autodocs"],
  args: {
    languages: LANGUAGES,
    value: "ar",
    onChange: () => {},
  },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: {
  isFilled?: (slug: string) => boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("ar");
  return (
    <LanguageSwitcher
      languages={LANGUAGES}
      value={value}
      onChange={setValue}
      isFilled={props.isFilled}
      disabled={props.disabled}
    />
  );
}

export const Default: Story = {
  render: () => <Controlled />,
};

export const WithFilledIndicators: Story = {
  render: () => <Controlled isFilled={(slug) => slug === "ar"} />,
};

export const Disabled: Story = {
  render: () => <Controlled isFilled={() => true} disabled />,
};
