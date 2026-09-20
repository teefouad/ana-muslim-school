"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { Alert, getDefaultZIndex, Group, Stack } from "@mantine/core";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFooter } from "@/components/ui/drawer-shell";
import { SaveButton } from "@/components/ui/save-button";
import {
  isSameTranslatedValue,
  type TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Lesson } from "@/lib/lessons/types";
import type { Question } from "@/lib/questions/types";
import { LessonForm } from "./lesson-form";
import {
  createEmptyLessonFieldsValues,
  isSameAzkar,
  toLessonFieldsValues,
  type LessonAzkarFieldEntry,
  type LessonFieldsValues,
} from "./lesson-fields";
import {
  hasInvalidQuestionText,
  isSameQuestionEntries,
  type ModuleQuestionGroup,
  type QuestionFieldEntry,
} from "./question-fields";

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
  /** Every Question currently loaded for the owning Module (ANA-119) --
   * used only to seed `questions` when `lesson` is given (see
   * `toLessonFieldsValues`); a brand-new New Lesson draft has no Questions
   * to seed regardless of this list's contents. */
  moduleQuestions: Question[];
  /** Every Question already defined in every Module before the owning one
   * in the Book's own Module order (ANA-120) -- forwarded to `LessonForm`'s
   * Insert action unchanged; see `QuestionsEditorProps.previousModuleQuestions`'s
   * own doc (questions-editor.tsx). */
  previousModuleQuestions: ModuleQuestionGroup[];
  /** The owning Module's own current Arabic Title/Description/Learning
   * Material (ANA-116) -- forwarded to `LessonForm` unchanged, grounding
   * both Title's and Description's AI Assistance suggestions in
   * the Edit Module modal's *current* draft, including unsaved edits. */
  moduleTitle: string;
  moduleDescription: string;
  moduleContent: string;
  /** Called when Save changes is clicked with no Lesson open (`lesson` is
   * `null`) -- persists a real Lesson through the existing Lesson create
   * API (ANA-116). Awaited: resolving keeps this editor open, now editing
   * the newly created Lesson in place (ANA-129 PR review -- the caller
   * switches its own `lessonEditorTarget` to the new id, see
   * `handleCreateLesson`, module-editor-body.tsx); rejecting also keeps
   * this editor open, preserving the draft, and shows the error.
   * `onQuestionSaved` (ANA-119 PR review) is invoked synchronously the
   * moment each Question draft's own create/update request succeeds --
   * *before* the overall Lesson create/update settles, so a draft that was
   * already persisted still counts as persisted even if a later Question
   * or the Lesson request itself then fails. Without this, retrying a
   * partially-failed Save would re-POST an already-created Question draft
   * (its local `id` still `null`), creating a duplicate/orphaned document
   * each retry. */
  onCreate: (
    fields: LessonFieldsValues,
    onQuestionSaved: (key: string, question: Question) => void,
  ) => Promise<void>;
  /** Called when Save changes is clicked with an existing Lesson open --
   * same awaited resolve/reject contract as `onCreate`, but PATCHes that
   * Lesson instead (ANA-116). See `onCreate`'s doc on `onQuestionSaved`. */
  onUpdate: (
    id: string,
    fields: LessonFieldsValues,
    onQuestionSaved: (key: string, question: Question) => void,
  ) => Promise<void>;
  /** Returns to Module mode without closing the Edit Module modal
   * (ANA-115). Called directly when there's no unsaved edit; gated behind
   * a "Discard unsaved changes?" confirmation (reusing the same
   * ConfirmDialog/copy as Module Builder's own unsaved-work guard,
   * import-source-modal.tsx) when the draft has diverged from its initial
   * values -- for New Lesson, "initial" is the blank defaults, so an
   * untouched New Lesson draft backs out with no confirmation and no
   * Lesson is ever added to the list. */
  onBack: () => void;
  /** The nested Lesson editor drawer's own Back button, Escape, and
   * outside/backdrop dismissal all funnel through `DrawerShell`'s
   * `onClose`/`onBack` (ANA-126), which `ModuleEditorBody` points at
   * `requestCloseRef.current()` instead of calling `onBack` directly, so
   * this editor's own dirty check runs first regardless of which of those
   * three dismissed it. */
  requestCloseRef?: MutableRefObject<() => void>;
}

// Lesson mode's editor (ANA-115, wired to the real Lesson backend in
// ANA-116): replaces Edit Module's Module editor/Lessons list content
// entirely -- never rendered alongside them (the three-column layout from
// ANA-111/ANA-114 is removed). Holds its own local draft state, fully
// separate from the Module form's own state in module-editor-body.tsx, so an
// in-progress Lesson edit can never bleed into the Module save payload or
// vice versa. Also handles New Lesson (`lesson` is `null`) -- Save is what
// decides create vs. update, purely from whether `lesson` was given, never
// a separate temporary Lesson object; no Lesson document is created merely
// by opening this editor, only by a successful `onCreate`.
export function LessonEditor({
  lesson,
  moduleQuestions,
  previousModuleQuestions,
  moduleTitle,
  moduleDescription,
  moduleContent,
  onCreate,
  onUpdate,
  onBack,
  requestCloseRef,
}: LessonEditorProps) {
  const initialFields = lesson
    ? toLessonFieldsValues(lesson, moduleQuestions)
    : createEmptyLessonFieldsValues();

  const [title, setTitle] = useState<TranslatedValue>(initialFields.title);
  const [description, setDescription] = useState<TranslatedValue>(
    initialFields.description,
  );
  const [type, setType] = useState(initialFields.type);
  const [position, setPosition] = useState(initialFields.position);
  const [isPublished, setIsPublished] = useState(initialFields.isPublished);
  const [content, setContent] = useState<TranslatedValue>(
    initialFields.content,
  );
  const [videoURL, setVideoURL] = useState(initialFields.videoURL);
  const [duration, setDuration] = useState(initialFields.duration);
  const [azkar, setAzkar] = useState<LessonAzkarFieldEntry[]>(
    initialFields.azkar,
  );
  const [questions, setQuestions] = useState<QuestionFieldEntry[]>(
    initialFields.questions,
  );

  // Mirrors the Module form's own busy-gating (ANA-109): Save stays
  // disabled while Title's or Description's own Translate with AI or AI
  // Assistance request is unresolved, since saving now would persist the
  // pre-translation/pre-suggestion value and the AI result would be lost
  // once it lands after a successful save has already unmounted this
  // editor. `questionsBusy` extends this to a Question's own Translate
  // action (ANA-119).
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [questionsBusy, setQuestionsBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy || questionsBusy;

  // Blocks Save while any Question's raw textarea buffer -- in either
  // language -- is currently unparseable (PR review, ANA-119): its
  // structured `text`/`explanation`/`choices` are frozen at their last
  // successfully parsed (possibly blank) state, so saving now would
  // silently persist that stale content instead of what's on screen. See
  // `hasInvalidQuestionText`'s own doc.
  const questionsInvalid = hasInvalidQuestionText(questions);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty =
    !isSameTranslatedValue(title, initialFields.title) ||
    !isSameTranslatedValue(description, initialFields.description) ||
    type !== initialFields.type ||
    position !== initialFields.position ||
    isPublished !== initialFields.isPublished ||
    !isSameTranslatedValue(content, initialFields.content) ||
    videoURL !== initialFields.videoURL ||
    duration !== initialFields.duration ||
    !isSameAzkar(azkar, initialFields.azkar) ||
    !isSameQuestionEntries(questions, initialFields.questions);

  // Gates this editor's own dismissal behind its unsaved-changes
  // confirmation (ANA-126) -- reached only through `requestCloseRef` below,
  // which the nested Lesson editor drawer points at this so its own Back
  // button, Escape, and outside/backdrop dismissal all funnel through here
  // instead of calling `onBack` directly (see that prop's own doc). A save
  // already in flight is never raced (mirrors `ModuleEditorBody`'s own
  // identical `handleRequestClose` guard): dismissing is simply ignored
  // until it settles.
  function handleRequestClose() {
    if (isSaving) {
      return;
    }

    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }

    onBack();
  }

  // Keeps the Lesson editor drawer's own dismiss bridge pointed at this
  // render's own `handleRequestClose` (ANA-126) -- same "effect, not a
  // direct render-time assignment" reasoning as `ModuleEditorBody`'s own
  // identical `requestCloseRef` effect: Mantine only ever reads this ref
  // from a later, separate event (the drawer actually being dismissed), by
  // which point the effect has already run.
  useEffect(() => {
    if (requestCloseRef) {
      requestCloseRef.current = handleRequestClose;
    }
  });

  // Persists the draft through the real Lesson create/update API (ANA-116)
  // -- awaited: resolving keeps this editor open (ANA-129 PR review: saving
  // must never change the screen), matching the Module form's own Save
  // contract in module-editor-body.tsx. Rejecting also keeps this editor
  // open, preserves every field exactly as typed, and shows the backend
  // error -- a failed create must never implicitly retry (the caller's
  // `onCreate` only ever issues one POST per call, see
  // module-editor-body.tsx).
  async function handleSave() {
    const fields: LessonFieldsValues = {
      title,
      description,
      type,
      position,
      isPublished,
      content,
      videoURL,
      duration,
      azkar,
      questions,
    };

    setSaveError(null);
    setIsSaving(true);

    // Promotes one Question draft's local `id` to its real, persisted id
    // the moment its own create/update request succeeds (ANA-119 PR
    // review) -- called by the caller from inside `saveLessonQuestions`,
    // strictly before this whole `onCreate`/`onUpdate` call settles. Keyed
    // by the entry's stable client-only `key` (never its `id`, which is
    // exactly what's being filled in here for a brand-new draft). This is
    // what makes retrying a partially-failed Save idempotent: if a later
    // Question or the Lesson request itself then fails, this draft is
    // already marked persisted in local state, so the next Save attempt
    // PATCHes (or skips, if unchanged) it instead of re-POSTing a
    // duplicate.
    function promoteQuestion(key: string, question: Question) {
      setQuestions((current) =>
        current.map((entry) =>
          entry.key === key ? { ...entry, id: question.id } : entry,
        ),
      );
    }

    try {
      if (lesson) {
        await onUpdate(lesson.id, fields, promoteQuestion);
      } else {
        await onCreate(fields, promoteQuestion);
      }

      // No `onBack()` here (ANA-129 PR review) -- saving must never change
      // the screen: an existing Lesson stays open, Save changes reflecting
      // back to clean once the caller's own Lessons SWR cache revalidates
      // with the saved values (`initialFields` above is read fresh from
      // `lesson` every render, not frozen, so it catches up on its own).
      // A brand-new Lesson also stays open -- the caller
      // (`handleCreateLesson`, module-editor-body.tsx) switches this same
      // editor into editing the newly created Lesson in place by updating
      // its own `lessonEditorTarget` once this resolves, rather than
      // calling `onBack` to return to Module mode.
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // The fields/error-banner region.
  const fields = (
    <>
      <LessonForm
        value={{
          title,
          description,
          type,
          position,
          isPublished,
          content,
          videoURL,
          duration,
          azkar,
          questions,
        }}
        onChange={(patch) => {
          if (patch.title !== undefined) setTitle(patch.title);
          if (patch.description !== undefined)
            setDescription(patch.description);
          if (patch.type !== undefined) setType(patch.type);
          if (patch.position !== undefined) setPosition(patch.position);
          if (patch.isPublished !== undefined)
            setIsPublished(patch.isPublished);
          if (patch.content !== undefined) setContent(patch.content);
          if (patch.videoURL !== undefined) setVideoURL(patch.videoURL);
          if (patch.duration !== undefined) setDuration(patch.duration);
          if (patch.azkar !== undefined) setAzkar(patch.azkar);
          if (patch.questions !== undefined) setQuestions(patch.questions);
        }}
        moduleTitle={moduleTitle}
        moduleDescription={moduleDescription}
        moduleContent={moduleContent}
        moduleQuestions={moduleQuestions}
        previousModuleQuestions={previousModuleQuestions}
        onTitleBusyChange={setTitleBusy}
        onDescriptionBusyChange={setDescriptionBusy}
        onQuestionsBusyChange={setQuestionsBusy}
      />

      {saveError && (
        <Alert color="red" role="alert">
          {saveError}
        </Alert>
      )}
    </>
  );

  const saveButton = (
    <SaveButton
      dirty={isDirty}
      onClick={() => void handleSave()}
      loading={isSaving}
      disabled={aiBusy || questionsInvalid}
    >
      Save changes
    </SaveButton>
  );

  return (
    <>
      {/* Renders the fields at their own natural height -- no internal
          fixed-height scroll region -- so the owning `DrawerShell`'s own
          body scrolls them as a whole, same as Module mode's own fields in
          that same drawer. Save changes portals into that drawer's real
          footer below instead of rendering here. */}
      <Stack gap="lg">{fields}</Stack>

      {/* Save changes (ANA-125 PR review): portaled into the owning
          `DrawerShell`'s own fixed footer via `DrawerFooter`, the same
          mechanism (and the same footer, since the nested Lesson editor
          drawer renders no `footer` prop of its own) Module mode's own Save
          changes already uses in that drawer (module-editor-body.tsx's
          `modeContent`), rather than a second, bespoke sticky/pinned
          section. */}
      <DrawerFooter>
        <Group justify="flex-end">{saveButton}</Group>
      </DrawerFooter>

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
          // Same reasoning as `ModuleEditorBody`'s own identical override
          // (module-editor-body.tsx) -- the nested Lesson editor drawer gets
          // a *stacked* z-index (`stackId="lesson-editor"`), which otherwise
          // buries this confirmation underneath its own overlay.
          zIndex={getDefaultZIndex("popover")}
        />
      )}
    </>
  );
}
