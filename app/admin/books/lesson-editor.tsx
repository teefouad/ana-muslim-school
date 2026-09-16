"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Stack } from "@mantine/core";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Lesson } from "@/lib/lessons/types";
import { LessonForm } from "./lesson-form";
import {
  createEmptyLessonFieldsValues,
  toLessonFieldsValues,
  type LessonFieldsValues,
} from "./lesson-fields";

function isSameTranslatedValue(a: TranslatedValue, b: TranslatedValue) {
  return (a.ar ?? "") === (b.ar ?? "") && (a.en ?? "") === (b.en ?? "");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
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
  lesson: Lesson | null;
  /** The owning Module's own current Arabic Title/Description/Learning
   * Material (ANA-116) -- forwarded to `LessonForm` unchanged, grounding
   * both Title's and One-line description's AI Assistance suggestions in
   * the Edit Module modal's *current* draft, including unsaved edits. */
  moduleTitle: string;
  moduleDescription: string;
  moduleContent: string;
  /** Called when Save changes is clicked with no Lesson open (`lesson` is
   * `null`) -- persists a real Lesson through the existing Lesson create
   * API (ANA-116). Awaited: resolving returns to Module mode; rejecting
   * keeps this editor open, preserves the draft, and shows the error. */
  onCreate: (fields: LessonFieldsValues) => Promise<void>;
  /** Called when Save changes is clicked with an existing Lesson open --
   * same awaited resolve/reject contract as `onCreate`, but PATCHes that
   * Lesson instead (ANA-116). */
  onUpdate: (id: string, fields: LessonFieldsValues) => Promise<void>;
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

// Lesson mode's editor (ANA-115, wired to the real Lesson backend in
// ANA-116): replaces Edit Module's Module editor/Lessons list content
// entirely -- never rendered alongside them (the three-column layout from
// ANA-111/ANA-114 is removed). Holds its own local draft state, fully
// separate from the Module form's own state in edit-module-modal.tsx, so an
// in-progress Lesson edit can never bleed into the Module save payload or
// vice versa. Also handles New Lesson (`lesson` is `null`) -- Save is what
// decides create vs. update, purely from whether `lesson` was given, never
// a separate temporary Lesson object; no Lesson document is created merely
// by opening this editor, only by a successful `onCreate`.
export function LessonEditor({
  lesson,
  moduleTitle,
  moduleDescription,
  moduleContent,
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
  // disabled while Title's or Description's own Translate with AI or AI
  // Assistance request is unresolved, since saving now would persist the
  // pre-translation/pre-suggestion value and the AI result would be lost
  // once it lands after a successful save has already unmounted this
  // editor.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy;

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Persists the draft through the real Lesson create/update API (ANA-116)
  // -- awaited: resolving returns to Module mode, matching the Module
  // form's own Save contract in edit-module-modal.tsx. Rejecting keeps this
  // editor open, preserves every field exactly as typed, and shows the
  // backend error -- a failed create must never implicitly retry (the
  // caller's `onCreate` only ever issues one POST per call, see
  // edit-module-modal.tsx).
  async function handleSave() {
    const fields: LessonFieldsValues = {
      title,
      description,
      type,
      position,
      isPublished,
    };

    setSaveError(null);
    setIsSaving(true);

    try {
      if (lesson) {
        await onUpdate(lesson.id, fields);
      } else {
        await onCreate(fields);
      }

      onBack();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // `height: "100%"` (ANA-117) -- this editor always renders inside a
    // fixed-height wrapper the caller sizes to match Module mode's own
    // content height, so switching between modes never resizes the modal
    // itself (edit-module-modal.tsx). Back/Save stay pinned outside the
    // scrollable middle `Stack` below rather than living inside it, so
    // they're never themselves scrolled out of view when the Lesson form's
    // own content is taller than the fixed height.
    <Stack gap="lg" style={{ height: "100%" }}>
      <Button
        variant="subtle"
        color="gray"
        px={0}
        style={{ alignSelf: "flex-start" }}
        leftSection={<ArrowLeft size={16} aria-hidden="true" />}
        onClick={handleBackClick}
        // Disabled while a Save request is in flight (ANA-116 PR review),
        // matching the Module editor's own Cancel button
        // (edit-module-modal.tsx). Without this, backing out (past the
        // discard confirmation, for a dirty draft) while Save is still
        // pending unmounts this editor before its request settles -- a
        // subsequent failure could then no longer show its error or
        // preserve the draft, exactly the outcome ANA-116 requires on a
        // failed save.
        disabled={isSaving}
      >
        Back to Module
      </Button>

      <Stack gap="lg" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
          moduleTitle={moduleTitle}
          moduleDescription={moduleDescription}
          moduleContent={moduleContent}
          onTitleBusyChange={setTitleBusy}
          onDescriptionBusyChange={setDescriptionBusy}
        />

        {saveError && (
          <Alert color="red" role="alert">
            {saveError}
          </Alert>
        )}
      </Stack>

      <Button
        onClick={() => void handleSave()}
        loading={isSaving}
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
