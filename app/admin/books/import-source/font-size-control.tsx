"use client";

import { Minus, Plus } from "lucide-react";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { useClampedStepper } from "./use-clamped-stepper";
import styles from "./control-group.module.css";

export const MIN_FONT_SCALE_PERCENT = 75;
export const MAX_FONT_SCALE_PERCENT = 200;
export const FONT_SCALE_STEP_PERCENT = 25;

export interface FontSizeControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function FontSizeControl({ value, onChange }: FontSizeControlProps) {
  const stepper = useClampedStepper(
    value,
    {
      min: MIN_FONT_SCALE_PERCENT,
      max: MAX_FONT_SCALE_PERCENT,
      step: FONT_SCALE_STEP_PERCENT,
    },
    onChange,
  );

  return (
    <div className={styles.group}>
      <ActionIconButton
        size={28}
        aria-label="Decrease font size"
        disabled={!stepper.canDecrement}
        onClick={stepper.decrement}
      >
        <Minus size={14} aria-hidden="true" />
      </ActionIconButton>
      <span className={styles.label}>{value}%</span>
      <ActionIconButton
        size={28}
        aria-label="Increase font size"
        disabled={!stepper.canIncrement}
        onClick={stepper.increment}
      >
        <Plus size={14} aria-hidden="true" />
      </ActionIconButton>
    </div>
  );
}
