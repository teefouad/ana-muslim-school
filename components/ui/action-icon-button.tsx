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
  className,
  ...props
}: ActionIconButtonProps) {
  return (
    <ActionIcon
      variant={variant}
      className={[styles.actionButton, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
