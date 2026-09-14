"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ActionIcon, type ActionIconProps } from "@mantine/core";

import styles from "./action-icon-button.module.css";

export type ActionIconButtonProps = ActionIconProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof ActionIconProps>;

// The shared icon-button used for every action button across the admin
// (ANA-105): AI Assistance/Translate with AI (FormField, the Edit Module
// modal's fields), Module Builder's AI Assistant/Translate/Delete, the
// Modules panel's Edit/Delete, and the Books/Users listing Edit/Delete --
// see action-icon-button.module.css for why this exists as one shared class
// rather than each screen styling its own copy. A thin wrapper around
// Mantine's `ActionIcon` rather than a new API: every prop (icon as
// `children`, `aria-label`, `disabled`, `loading`, `onClick`, `color` for a
// deliberate exception like a destructive action) passes straight through,
// so converting a call site is just swapping the import and dropping its
// own `className`.
export function ActionIconButton({
  variant = "subtle",
  color,
  className,
  ...props
}: ActionIconButtonProps) {
  // `color="red"` is this component's only real-world use of `color`, for a
  // destructive action (Delete) -- every other action button uses the
  // default color. Branching on it once here drives both fixes below rather
  // than requiring each call site to know about either.
  const isDestructive = color === "red";

  return (
    <ActionIcon
      variant={variant}
      // An unshaded theme color name resolves through Mantine's
      // `*-light-color` token for the "subtle"/"light" variants -- a token
      // designed to read against that *same variant's own* tinted
      // background, not against this button's transparent one. In dark mode
      // that token is `red-0` (near white), so an unshaded "subtle" red
      // button renders almost indistinguishable from every other action
      // button instead of visibly red. Pinning an explicit shade sidesteps
      // that token entirely -- Mantine's numeric shades (0-9) are the same
      // swatch in both color schemes, unlike the semantic light/dark tokens.
      color={isDestructive ? "red.6" : color}
      className={[
        styles.actionButton,
        // Gives a destructive action's hover a translucent red instead of
        // the neutral white every other action button gets -- see
        // `.destructive` in action-icon-button.module.css.
        isDestructive && styles.destructive,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
