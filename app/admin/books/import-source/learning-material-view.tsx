"use client";

import { Button, Group, Text } from "@mantine/core";
import { ArrowLeft } from "lucide-react";

import type { TempModule, TextDirection } from "./import-source-types";
import { FontSizeControl } from "./font-size-control";
import { LearningMaterialCard } from "./learning-material-card";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./learning-material-view.module.css";

export interface LearningMaterialViewProps {
  fileName: string;
  modules: TempModule[];
  /** Temporary Learning Material Markdown, keyed by Module id. A Module
   * with no entry here is treated as an empty Learning Material. Never
   * persisted -- this whole screen is UI-only (ANA-69); wiring it to
   * `/api/v1/materials` is explicitly deferred to a follow-up card. */
  learningMaterials: Record<string, string>;
  onLearningMaterialsChange: (
    learningMaterials: Record<string, string>,
  ) => void;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
  onBack: () => void;
}

// Step 5, the Learning Material step in the Import Source modal (ANA-69).
// Reached from the Module-building step's "Create Learning Material"
// button. Renders the temporary Modules (already built in the previous
// step) in their current order, each with its source text as read-only
// reference alongside the School Markdown editor for its Learning
// Material -- all of it kept in modal/client state only.
export function LearningMaterialView({
  fileName,
  modules,
  learningMaterials,
  onLearningMaterialsChange,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
  onBack,
}: LearningMaterialViewProps) {
  function handleLearningMaterialChange(moduleId: string, value: string) {
    onLearningMaterialsChange({ ...learningMaterials, [moduleId]: value });
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <Text size="sm" fw={500}>
            {fileName}
          </Text>
          <Text size="xs" c="dimmed">
            {modules.length} {modules.length === 1 ? "module" : "modules"}{" "}
            created
          </Text>
        </div>
        <Group gap="sm">
          <FontSizeControl value={fontScale} onChange={onFontScaleChange} />
          <TextDirectionControl
            value={direction}
            onChange={onDirectionChange}
          />
        </Group>
      </div>

      <div className={styles.body}>
        {modules.map((module, index) => (
          <LearningMaterialCard
            key={module.id}
            module={module}
            index={index}
            learningMaterial={learningMaterials[module.id] ?? ""}
            onLearningMaterialChange={(value) =>
              handleLearningMaterialChange(module.id, value)
            }
            direction={direction}
            fontScale={fontScale}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <Button
          variant="default"
          leftSection={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
        >
          Back to Modules
        </Button>
      </div>
    </div>
  );
}
