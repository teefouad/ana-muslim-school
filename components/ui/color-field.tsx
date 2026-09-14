"use client";

import { Autocomplete, ColorSwatch, Group } from "@mantine/core";

import {
  APPLICATION_COLOR_TOKENS,
  resolveApplicationColor,
} from "./application-colors";
import { ColorSwatchPicker } from "./color-swatch-picker";

export interface ColorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// The Book form's Color field (ANA-63/ANA-89), extracted as a shared
// primitive (ANA-91) so any form needing the same "named token or free-form
// value" color field -- currently Book and Module -- uses the exact same
// component instead of each reimplementing the Autocomplete + swatch-picker
// pairing. Each instance is fully controlled and owns no state of its own,
// so two instances on the same page (e.g. a Book form and a Module modal)
// never share or clash over a value.
//
// The ColorSwatch between the Autocomplete and the picker grid (ANA-106) is
// a live preview of `value`, resolved through `resolveApplicationColor` so a
// named token (e.g. "pink.6") and a free-form value (e.g. a typed hex) both
// paint correctly. It's purely decorative (`aria-hidden`) -- the Autocomplete
// already exposes the value as text -- so it carries no independent
// interaction or disabled state of its own to preserve.
export function ColorField({
  label = "Color",
  value,
  onChange,
  disabled,
}: ColorFieldProps) {
  return (
    <Group style={{ position: "relative", alignItems: "flex-end" }}>
      <Autocomplete
        label={label}
        data={APPLICATION_COLOR_TOKENS}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ flex: "0 0 140px" }}
      />
      <ColorSwatch
        color={resolveApplicationColor(value)}
        size={24}
        withShadow={false}
        title={value}
        aria-hidden="true"
        data-testid="color-field-preview"
        radius={5}
        style={{
          position: "absolute",
          bottom: 6,
          left: 110,
        }}
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
        <ColorSwatchPicker
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </Group>
  );
}
