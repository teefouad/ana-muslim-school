"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import styles from "./list-header-action.module.css";

export interface ListHeaderActionProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "className" | "type"
> {
  icon: ReactNode;
  children: ReactNode;
}

// A list's compact text header action (ANA-120, extracted in ANA-129 so the
// Break entries list's own Add entry action reuses the exact same look
// instead of a separate Mantine `Button` -- see questions-editor.tsx's
// New/Insert/Generate for the original usage this pulls from and
// list-header-action.module.css for why it's a plain styled `<button>`
// rather than Mantine's own `Button`).
export function ListHeaderAction({
  icon,
  children,
  ...props
}: ListHeaderActionProps) {
  return (
    <button type="button" className={styles.action} {...props}>
      {icon}
      {children}
    </button>
  );
}
