"use client";

import { Autocomplete, Group } from "@mantine/core";

import { APPLICATION_COLOR_TOKENS } from "./application-colors";
import { ColorSwatchPicker } from "./color-swatch-picker";

export interface ColorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

// The Book form's Color field (ANA-63/ANA-89), extracted as a shared
// primitive (ANA-91) so any form needing the same "named token or free-form
// value" color field -- currently Book and Module -- uses the exact same
// component instead of each reimplementing the Autocomplete + swatch-picker
// pairing. Each instance is fully controlled and owns no state of its own,
// so two instances on the same page (e.g. a Book form and a Module modal)
// never share or clash over a value.
export function ColorField({
  label = "Color",
  value,
  onChange,
}: ColorFieldProps) {
  return (
    <Group style={{ alignItems: "flex-end" }}>
      <Autocomplete
        label={label}
        data={APPLICATION_COLOR_TOKENS}
        value={value}
        onChange={onChange}
        style={{ flex: "0 0 100px" }}
      />
      <div
        style={{
          flex: 1,
          marginTop: 6,
          height: 36,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <ColorSwatchPicker value={value} onChange={onChange} />
      </div>
    </Group>
  );
}
