"use client";

import { Alert, Button, Group, Text } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { TempModule } from "./import-source-types";
import { FontSizeControl } from "./font-size-control";
import { LearningMaterialModuleCard } from "./learning-material-module-card";
import { SortableList } from "@/components/ui/sortable-list";
import styles from "./learning-material-view.module.css";

export interface LearningMaterialViewProps {
  fileName: string;
  modules: TempModule[];
  onModulesChange: (modules: TempModule[]) => void;
  /** Each temporary Module's bilingual Learning Material draft (ANA-75),
   * keyed by Module id. A Module with no entry here is treated as an empty
   * `{ ar: "", en: "" }` draft. Never persisted -- this whole screen is
   * UI-only (ANA-69); wiring it to `/api/v1/materials` is deferred to
   * Finish. */
  learningMaterials: Record<string, TranslatableString>;
  onLearningMaterialsChange: (
    learningMaterials: Record<string, TranslatableString>,
  ) => void;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
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

const EMPTY_MATERIAL: TranslatableString = { ar: "", en: "" };

function SortableLearningMaterialCard({
  module,
  index,
  material,
  onMaterialChange,
  fontScale,
  disabled,
}: {
  module: TempModule;
  index: number;
  material: TranslatableString;
  onMaterialChange: (value: TranslatableString) => void;
  fontScale: number;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, disabled });

  return (
    <LearningMaterialModuleCard
      testId={`learning-material-card-${module.id}`}
      index={index}
      material={material}
      onMaterialChange={onMaterialChange}
      fontScale={fontScale}
      disabled={disabled}
      drag={{
        attributes,
        listeners,
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        isDragging,
      }}
    />
  );
}

// Step 5, the Learning Material step in the Import Source modal (ANA-69).
// Reached from the Module-building step's "Create Learning Material"
// button. Renders the same shared Module-card shell as the saved-Source
// workspace (LearningMaterialModuleCard, ANA-75) for each temporary Module,
// still fully draggable/reorderable here (unlike the saved-Source
// workspace, where reordering stays out of scope) -- kept in client/modal
// state only until Finish persists it.
export function LearningMaterialView({
  fileName,
  modules,
  onModulesChange,
  learningMaterials,
  onLearningMaterialsChange,
  fontScale,
  onFontScaleChange,
  onBack,
  onFinish,
  isFinishing,
  finishError,
  backDisabled,
}: LearningMaterialViewProps) {
  function handleLearningMaterialChange(
    moduleId: string,
    value: TranslatableString,
  ) {
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
        </Group>
      </div>

      <div className={styles.body}>
        <SortableList<TempModule>
          items={modules}
          getId={(module) => module.id}
          onReorder={onModulesChange}
          renderItem={(module, index) => (
            <SortableLearningMaterialCard
              key={module.id}
              module={module}
              index={index}
              material={learningMaterials[module.id] ?? EMPTY_MATERIAL}
              onMaterialChange={(value) =>
                handleLearningMaterialChange(module.id, value)
              }
              fontScale={fontScale}
              disabled={isFinishing}
            />
          )}
          renderOverlay={(module, index) => (
            <LearningMaterialModuleCard
              testId={`learning-material-card-overlay-${module.id}`}
              index={index}
              material={learningMaterials[module.id] ?? EMPTY_MATERIAL}
              onMaterialChange={() => {}}
              fontScale={fontScale}
              disabled
            />
          )}
        />
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
