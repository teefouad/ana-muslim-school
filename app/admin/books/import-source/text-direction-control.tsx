"use client";

import { AlignLeft, AlignRight } from "lucide-react";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import type { TextDirection } from "./import-source-types";
import styles from "./control-group.module.css";

export interface TextDirectionControlProps {
  value: TextDirection;
  onChange: (value: TextDirection) => void;
}

export function TextDirectionControl({
  value,
  onChange,
}: TextDirectionControlProps) {
  return (
    <div className={styles.group}>
      <ActionIconButton
        variant={value === "ltr" ? "light" : "subtle"}
        size={28}
        aria-pressed={value === "ltr"}
        aria-label="Left to right"
        onClick={() => onChange("ltr")}
      >
        <AlignLeft size={14} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton
        variant={value === "rtl" ? "light" : "subtle"}
        size={28}
        aria-pressed={value === "rtl"}
        aria-label="Right to left"
        onClick={() => onChange("rtl")}
      >
        <AlignRight size={14} aria-hidden="true" />
      </ActionIconButton>
    </div>
  );
}
