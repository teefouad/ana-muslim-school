"use client";

import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";

import {
  APPLICATION_COLORS,
  type ApplicationColorToken,
} from "./application-colors";
import styles from "./color-swatch-picker.module.css";

// The exact 15-color palette and order ANA-89 specifies for the Edit Book
// color swatch control. `APPLICATION_COLORS` also holds grayscale/UI tokens
// (gray, dark, white, black, ...) that aren't meant for this picker, so the
// set is spelled out explicitly here rather than derived from it.
const SWATCH_COLOR_NAMES = [
  "night",
  "cream",
  "orange",
  "gold",
  "yellow",
  "lime",
  "green",
  "teal",
  "dark",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "grape",
  "pink",
  "red",
] as const;

function swatchLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export interface ColorSwatchPickerProps {
  /** The Book form's `color` field value. A swatch shows as selected only
   * when this exactly matches its `<name>.6` token -- any other value (a
   * different shade, a free-form hex) leaves every swatch unselected. */
  value: string;
  onChange: (value: string) => void;
}

// 15 adjacent, fixed-width color swatches (ANA-89) replacing the old single
// preview box next to the Book form's "Color" field. Each swatch paints
// shade `6` of one of the supported application colors; clicking one sets
// the field to that swatch's `<name>.6` token.
export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, token: string) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      // A held key repeats keydown events -- only the initial press should
      // select, or a long press would re-fire the same selection.
      if (!event.repeat) {
        onChange(token);
      }
    }
  }

  return (
    <div role="radiogroup" aria-label="Color" className={styles.group}>
      {SWATCH_COLOR_NAMES.map((name) => {
        const token: ApplicationColorToken = `${name}.6`;
        const selected = value === token;

        return (
          <div
            key={name}
            role="radio"
            tabIndex={0}
            aria-checked={selected}
            aria-label={swatchLabel(name)}
            className={styles.swatch}
            style={{
              backgroundColor: APPLICATION_COLORS[token],
            }}
            onClick={() => onChange(token)}
            onKeyDown={(event) => handleKeyDown(event, token)}
          >
            {selected && (
              <Check
                size={14}
                strokeWidth={4}
                className={styles.check}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
