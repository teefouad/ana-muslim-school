"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Stack } from "@mantine/core";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Lesson } from "@/lib/lessons/types";
import { LessonForm } from "./lesson-form";
import { toLessonFieldsValues, type LessonFieldsValues } from "./lesson-fields";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function isSameTranslatedValue(a: TranslatedValue, b: TranslatedValue) {
  return (a.ar ?? "") === (b.ar ?? "") && (a.en ?? "") === (b.en ?? "");
}

export interface LessonEditorProps {
  /** The Lesson currently open for editing (ANA-115) -- seeds this
   * editor's own local draft state. The caller remounts this component
   * (`key={lesson.id}`) whenever a different Lesson is opened, so editing
   * or discarding one Lesson's draft can never leak into another's. */
  lesson: Lesson;
  /** Saves only this Lesson through the existing Lesson persistence/API
   * flow (ANA-115) -- awaited the same way EditModuleModal's own Module
   * save is: resolving returns to Module mode (handled by the caller,
   * which owns that transition), rejecting keeps this editor open with the
   * draft intact and shows the error. */
  onSave: (id: string, fields: LessonFieldsValues) => Promise<void>;
  /** Returns to Module mode without closing the Edit Module modal
   * (ANA-115). Called directly when there's no unsaved edit; gated behind
   * a "Discard unsaved changes?" confirmation (reusing the same
   * ConfirmDialog/copy as Module Builder's own unsaved-work guard,
   * import-source-modal.tsx) when the draft has diverged from the Lesson's
   * last-saved fields. */
  onBack: () => void;
}

// Lesson mode's editor (ANA-115): replaces Edit Module's Module editor/
// Lessons list content entirely -- never rendered alongside them (the
// three-column layout from ANA-111/ANA-114 is removed). Holds its own
// local draft state, fully separate from the Module form's own state in
// edit-module-modal.tsx, so an in-progress Lesson edit can never bleed
// into the Module save payload or vice versa.
export function LessonEditor({ lesson, onSave, onBack }: LessonEditorProps) {
  const initialFields = toLessonFieldsValues(lesson);

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

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);

    try {
      await onSave(lesson.id, {
        title,
        description,
        type,
        position,
        isPublished,
      });
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
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
        disabled={isSaving}
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

      {saveError && (
        <Alert color="red" role="alert">
          {saveError}
        </Alert>
      )}

      <Button
        onClick={() => void handleSave()}
        loading={isSaving}
        disabled={aiBusy}
        style={{ alignSelf: "flex-end" }}
      >
        Save lesson
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
