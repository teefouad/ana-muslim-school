import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ColorField } from "./color-field";
import { DEFAULT_APPLICATION_COLOR } from "./application-colors";

const meta = {
  title: "UI/ColorField",
  component: ColorField,
  tags: ["autodocs"],
  args: {
    value: DEFAULT_APPLICATION_COLOR,
    onChange: () => {},
  },
} satisfies Meta<typeof ColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledField(props: {
  initialValue?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(
    props.initialValue ?? DEFAULT_APPLICATION_COLOR,
  );
  return (
    <div style={{ width: 420 }}>
      <ColorField
        label={props.label}
        value={value}
        onChange={setValue}
        disabled={props.disabled}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledField />,
};

export const NamedTokenSelected: Story = {
  render: () => <ControlledField initialValue="cyan.6" />,
};

export const FreeFormValue: Story = {
  render: () => <ControlledField initialValue="#7c3aed" />,
};

// Suspends editing (ANA-94) -- e.g. while the Edit Module modal's AI
// Translate/Suggest is in flight and could still overwrite the value.
export const Disabled: Story = {
  render: () => <ControlledField initialValue="cyan.6" disabled />,
};

// Two independent instances on the same page (e.g. a Book form and a Module
// form) never share or clash over a value (ANA-91).
export const TwoIndependentInstances: Story = {
  render: function Render() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ width: 420 }}>
          <ControlledField label="Book color" initialValue="blue.6" />
        </div>
        <div style={{ width: 420 }}>
          <ControlledField label="Module color" initialValue="teal.6" />
        </div>
      </div>
    );
  },
};
