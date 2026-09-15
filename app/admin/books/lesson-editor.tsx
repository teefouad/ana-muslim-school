"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Stack } from "@mantine/core";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import { LessonForm } from "./lesson-form";
import {
  createEmptyLessonFieldsValues,
  toLessonFieldsValues,
  type LessonFieldsValues,
} from "./lesson-fields";
import type { MockLesson } from "./mock-lessons";

function isSameTranslatedValue(a: TranslatedValue, b: TranslatedValue) {
  return (a.ar ?? "") === (b.ar ?? "") && (a.en ?? "") === (b.en ?? "");
}

export interface LessonEditorProps {
  /** The Lesson currently open for editing, or `null` for New Lesson
   * (ANA-115) -- seeds this editor's own local draft state, and is the
   * *only* signal this editor uses to decide whether Save creates or
   * updates: no separate temporary/persisted Lesson model exists, only
   * this id's presence. The caller remounts this component (`key={lesson
   * ?.id ?? "new"}`) whenever a different Lesson (or a fresh New Lesson) is
   * opened, so editing or discarding one draft can never leak into
   * another's. */
  lesson: MockLesson | null;
  /** Called when Save changes is clicked with no Lesson open (`lesson` is
   * `null`) -- applies the form values to the local Lessons UI state only
   * (ANA-115: frontend-only, no Lesson API/Firestore write; real
   * persistence is deferred to ANA-116). Synchronous -- there is no
   * network request to await, so this can never fail. */
  onCreate: (fields: LessonFieldsValues) => void;
  /** Called when Save changes is clicked with an existing Lesson open --
   * same local-UI-state-only contract as `onCreate`. */
  onUpdate: (id: string, fields: LessonFieldsValues) => void;
  /** Returns to Module mode without closing the Edit Module modal
   * (ANA-115). Called directly when there's no unsaved edit; gated behind
   * a "Discard unsaved changes?" confirmation (reusing the same
   * ConfirmDialog/copy as Module Builder's own unsaved-work guard,
   * import-source-modal.tsx) when the draft has diverged from its initial
   * values -- for New Lesson, "initial" is the blank defaults, so an
   * untouched New Lesson draft backs out with no confirmation and no
   * Lesson is ever added to the list. */
  onBack: () => void;
}

// Lesson mode's editor (ANA-115): replaces Edit Module's Module editor/
// Lessons list content entirely -- never rendered alongside them (the
// three-column layout from ANA-111/ANA-114 is removed). Holds its own
// local draft state, fully separate from the Module form's own state in
// edit-module-modal.tsx, so an in-progress Lesson edit can never bleed
// into the Module save payload or vice versa. Also handles New Lesson
// (`lesson` is `null`) -- Save is what decides create vs. update, purely
// from whether `lesson` was given, never a separate temporary Lesson
// object. Frontend-only: `onCreate`/`onUpdate` only ever touch local
// Lessons UI state (ANA-111/ANA-114's own local data) -- real Lesson
// persistence is deferred to ANA-116.
export function LessonEditor({
  lesson,
  onCreate,
  onUpdate,
  onBack,
}: LessonEditorProps) {
  const initialFields = lesson
    ? toLessonFieldsValues(lesson)
    : createEmptyLessonFieldsValues();

  const [title, setTitle] = useState<TranslatedValue>(initialFields.title);
  const [description, setDescription] = useState<TranslatedValue>(
    initialFields.description,
  );
  const [type, setType] = useState(initialFields.type);
  const [position, setPosition] = useState(initialFields.position);
  const [isPublished, setIsPublished] = useState(initialFields.isPublished);

  // Mirrors the Module form's own busy-gating (ANA-109): Save stays
  // disabled while Title's or Description's own Translate with AI request
  // is unresolved, since saving now would persist the pre-translation
  // value and the AI result would be lost once it lands after a
  // successful save has already unmounted this editor.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy;

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const isDirty =
    !isSameTranslatedValue(title, initialFields.title) ||
    !isSameTranslatedValue(description, initialFields.description) ||
    type !== initialFields.type ||
    position !== initialFields.position ||
    isPublished !== initialFields.isPublished;

  function handleBackClick() {
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }

    onBack();
  }

  // Local-state-only (ANA-115): applies the draft to the Lessons list and
  // returns to Module mode in the same tick -- there's no request to await
  // and thus no failure path, unlike Module Save's own backend-persisted
  // flow.
  function handleSave() {
    const fields: LessonFieldsValues = {
      title,
      description,
      type,
      position,
      isPublished,
    };

    if (lesson) {
      onUpdate(lesson.id, fields);
    } else {
      onCreate(fields);
    }

    onBack();
  }

  return (
    <Stack gap="lg">
      <Button
        variant="subtle"
        color="gray"
        px={0}
        style={{ alignSelf: "flex-start" }}
        leftSection={<ArrowLeft size={16} aria-hidden="true" />}
        onClick={handleBackClick}
      >
        Back to Module
      </Button>

      <LessonForm
        value={{ title, description, type, position, isPublished }}
        onChange={(patch) => {
          if (patch.title !== undefined) setTitle(patch.title);
          if (patch.description !== undefined)
            setDescription(patch.description);
          if (patch.type !== undefined) setType(patch.type);
          if (patch.position !== undefined) setPosition(patch.position);
          if (patch.isPublished !== undefined)
            setIsPublished(patch.isPublished);
        }}
        onTitleBusyChange={setTitleBusy}
        onDescriptionBusyChange={setDescriptionBusy}
      />

      <Button
        onClick={handleSave}
        disabled={aiBusy}
        style={{ alignSelf: "flex-end" }}
      >
        Save changes
      </Button>

      {confirmingDiscard && (
        <ConfirmDialog
          opened
          title="Discard unsaved changes?"
          description="Your changes have not been saved and will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmingDiscard(false)}
          onConfirm={() => {
            setConfirmingDiscard(false);
            onBack();
          }}
        />
      )}
    </Stack>
  );
}
