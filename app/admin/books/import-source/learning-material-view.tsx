"use client";

import { Alert, Button, Group, Text } from "@mantine/core";
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
  /** Creates every temporary Module for the current Book through the
   * existing Module API, in order (ANA-70). */
  onFinish: () => void;
  /** True while a Finish operation is in flight -- disables the button
   * (showing a loading state) and guards against duplicate submission from
   * repeated clicks. */
  isFinishing: boolean;
  /** Set when Module creation fails; cleared on the next Finish attempt.
   * The modal stays open so the user can retry without losing progress. */
  finishError: string | null;
  /** True once at least one temporary Module has already been persisted in
   * the current Finish session (a partial failure) -- disables Back to
   * Modules so the Module builder can't reorder/delete/change the temporary
   * set out from under Modules that already exist under the Book and can't
   * be rolled back from here. Retrying Finish from this step is still the
   * way forward (PR review, ANA-70). */
  backDisabled: boolean;
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
  onFinish,
  isFinishing,
  finishError,
  backDisabled,
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

      {finishError && (
        <Alert color="red" mx="md" mb="sm">
          {finishError}
        </Alert>
      )}

      {backDisabled && (
        <Text size="xs" c="dimmed" mx="md" mb="sm">
          Some Modules have already been created for this Book -- Back to
          Modules is unavailable until Finish completes. Retry Finish below.
        </Text>
      )}

      <div className={styles.footer}>
        <Button
          variant="default"
          leftSection={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
          disabled={backDisabled}
        >
          Back to Modules
        </Button>
        <Button
          ml="auto"
          disabled={modules.length === 0 || isFinishing}
          loading={isFinishing}
          onClick={onFinish}
        >
          Finish
        </Button>
      </div>
    </div>
  );
}
