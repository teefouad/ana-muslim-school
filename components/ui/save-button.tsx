"use client";

import { Button, type ButtonProps } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";

// Unsaved-changes color (ANA-129 PR review) -- not one of this theme's own
// named colors (see `--mantine-primary-color-filled` in globals.css), so a
// literal hex is passed straight through to Mantine's `color` prop, which
// accepts any valid CSS color, not just a theme color name.
const DIRTY_COLOR = "#fd9c20";

export type SaveButtonProps = Omit<ButtonProps, "color"> &
  Omit<ComponentPropsWithoutRef<"button">, keyof ButtonProps> & {
    /** Whether the form/editor this button saves currently has unsaved
     * changes (ANA-129). It was previously impossible to tell an editor's
     * Save Changes button had unsaved work waiting -- every primary Button
     * renders in this theme's own primary green
     * (`--mantine-primary-color-filled`, globals.css) regardless of dirty
     * state. This wraps the plain `Button` used for every "Save changes"/
     * "Save Module"/"Save access" action across the admin so they all
     * reflect it the same way instead of each screen reinventing the same
     * `color` branch: `DIRTY_COLOR` while there are unsaved changes, the
     * theme's usual primary green (the default, no override) once there's
     * nothing left to save. `color` is omitted from this component's own
     * props -- it fully owns the color, so a caller can't accidentally
     * fight `dirty` with its own override. */
    dirty: boolean;
  };

// Shared Save button for every editor's primary save action (ANA-129) --
// see `dirty`'s own doc above for why this exists as one component rather
// than each caller branching `color` itself.
export function SaveButton({ dirty, ...props }: SaveButtonProps) {
  return <Button color={dirty ? DIRTY_COLOR : undefined} {...props} />;
}
