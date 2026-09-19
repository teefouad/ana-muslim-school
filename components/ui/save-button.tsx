"use client";

import { Button, type ButtonProps } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";

export type SaveButtonProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof ButtonProps> & {
    /** Whether the form/editor this button saves currently has unsaved
     * changes (ANA-129). It was previously impossible to tell an editor's
     * Save Changes button had unsaved work waiting -- every primary Button
     * renders in this theme's own primary green
     * (`--mantine-primary-color-filled`, globals.css) regardless of dirty
     * state. This wraps the plain `Button` used for every "Save changes"/
     * "Save Module"/"Save access" action across the admin so they all
     * reflect it the same way instead of each screen reinventing the same
     * `color` branch: black (Mantine's "dark" filled color) while there's
     * nothing to save, the theme's usual primary green once something has
     * changed. */
    dirty: boolean;
  };

// Shared Save button for every editor's primary save action (ANA-129) --
// see `dirty`'s own doc above for why this exists as one component rather
// than each caller branching `color` itself.
export function SaveButton({ dirty, color, ...props }: SaveButtonProps) {
  return <Button color={dirty ? color : "dark"} {...props} />;
}
