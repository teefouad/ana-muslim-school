"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { Box, Group, Stack, Switch, Text } from "@mantine/core";

import styles from "./toggle-card.module.css";

export type ToggleCardVariant = "primary" | "error";

export interface ToggleCardProps {
  label: ReactNode;
  /** Shown below the label. Omit for a label-only card. */
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** `primary` for an affirmative setting (e.g. Published); `error` for a
   * destructive one (e.g. Locked). @default 'primary' */
  variant?: ToggleCardVariant;
  disabled?: boolean;
  className?: string;
}

// A Mantine-based card matching the old Ana Muslim Admin Locked/Published
// control: the entire card is the switch's hit target, rather than only a
// small control on the right. The visible Mantine `Switch` is purely
// presentational here (`aria-hidden`, unfocusable, and non-interactive via
// `pointer-events: none` in the CSS module) so a click anywhere on the card
// -- including directly on the switch -- always lands on this outer element
// and resolves to exactly one toggle. This element is what actually carries
// `role="switch"`/`aria-checked`, since a plain `<input type="checkbox">`
// (which is what `Switch` renders) exposes checkbox semantics, not switch
// semantics.
export function ToggleCard({
  label,
  description,
  checked,
  onChange,
  variant = "primary",
  disabled = false,
  className,
}: ToggleCardProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-description`;

  function toggle() {
    if (!disabled) {
      onChange(!checked);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " " || event.key === "Enter") {
      // Prevents the space key from also scrolling the page.
      event.preventDefault();
      toggle();
    }
  }

  return (
    <Box
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={[
        styles.card,
        checked &&
          (variant === "error" ? styles.checkedError : styles.checkedPrimary),
        disabled && styles.disabled,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text id={labelId} size="sm" fw={500}>
            {label}
          </Text>
          {description && (
            <Text id={descriptionId} size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        <Switch
          checked={checked}
          disabled={disabled}
          color={variant === "error" ? "red" : undefined}
          tabIndex={-1}
          aria-hidden="true"
          readOnly
          className={styles.switch}
          onChange={() => {}}
        />
      </Group>
    </Box>
  );
}
