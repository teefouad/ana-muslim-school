"use client";

import { useState } from "react";
import { Alert, Box, Button, Flex, Group, Modal, Stack } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { FormField } from "@/components/ui/form-field";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Book } from "@/lib/books/types";
import {
  assistLearningMaterial,
  suggestModuleDescription,
  suggestModuleTitle,
} from "./import-source/ai-assist-client";
import { translateModuleField } from "./import-source/translate-client";
import { LessonEditor } from "./lesson-editor";
import type { LessonFieldsValues } from "./lesson-fields";
import { LessonsPanel } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** `"create"` opens the modal empty, with Save Module as its primary action
 * (ANA-94) -- clicking Add Module no longer inserts anything into the
 * Module list itself; that only happens once this modal's own backend
 * create request succeeds (see `[id]/edit/page.tsx`'s `handleCreateModule`).
 * `"edit"` seeds it from an existing, real Module's current fields, primary
 * action Save changes -- unchanged from ANA-91 except that saving now
 * persists through the backend instead of only updating local state.
 * `lessons` (ANA-111) is this Module's Lessons list, in display order --
 * optional and local-UI-only, since real Lesson loading/persistence is out
 * of scope for this task (deferred to ANA-116); omitted (or empty) shows
 * the Lessons list's own empty state. */
export type EditModuleModalState =
  | { mode: "create" }
  | {
      mode: "edit";
      id: string;
      fields: ModuleFieldsValues;
      lessons?: MockLesson[];
    };

export interface EditModuleModalProps {
  /** `null` closes the modal. */
  state: EditModuleModalState | null;
  /** The owning Book -- its `id` is what every AI action here sends as
   * `bookId` (the server always reloads the Book fresh from it for its own
   * Book-level context, never trusting client-sent Book fields, ANA-85),
   * and its Title/Description/Long description are read directly by this
   * modal's own AI context builders (ANA-98) -- the Edit Book page already
   * has the full `Book` loaded, so this needs no second fetch. */
  book: Book;
  onClose: () => void;
  /** Called with the modal's current field values when Save Module is
   * clicked in create mode. The modal awaits this -- resolving creates the
   * Module through the backend and closes the modal; rejecting keeps the
   * modal open and shows the error, without ever calling `onClose` itself
   * (ANA-94: "only add the Module to the list after creation succeeds"). */
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  /** Called with the modal's current field values when Save changes is
   * clicked in edit mode. Same awaited resolve/reject contract as
   * `onCreate`. */
  onSave: (id: string, fields: ModuleFieldsValues) => Promise<void>;
}

// Top-level modal (ANA-91) opened from the Edit Book screen's Modules panel
// -- deliberately a sibling of, not nested inside, the Module Builder modal
// (ImportSourceModal). Reused for both Add Module (create mode) and the
// pencil action (edit mode) rather than duplicating the form (ANA-94) --
// only the title, primary action label, and which callback Save invokes
// differ between the two.
export function EditModuleModal({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: EditModuleModalProps) {
  return (
    <Modal
      opened={state !== null}
      onClose={onClose}
      title={state?.mode === "create" ? "Add Module" : "Edit Module"}
      // Edit mode's own fixed 900px width (ANA-115 PR review) -- the same
      // for both Module mode (Module editor + Lessons list) and Lesson
      // mode (the Lesson editor takes over that same width), so the modal
      // never grows/shrinks when switching between them. Capped against
      // the viewport the same way Module Builder's own wide modal is
      // (import-source-modal.tsx), rather than a fixed size that would
      // overflow a narrow viewport.
      size={state?.mode === "edit" ? "min(900px, calc(100vw - 48px))" : "lg"}
      centered
    >
      {state && (
        <EditModuleModalBody
          // Remounts (a fresh local draft) per distinct edit target, and
          // whenever create mode is (re-)entered after a different state --
          // matching BookForm/DeleteConfirmModal's own "T | null as the open
          // signal" pattern.
          key={state.mode === "create" ? "create" : state.id}
          state={state}
          book={book}
          onClose={onClose}
          onCreate={onCreate}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function EditModuleModalBody({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: {
  state: EditModuleModalState;
  book: Book;
  onClose: () => void;
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  onSave: (id: string, fields: ModuleFieldsValues) => Promise<void>;
}) {
  const initialFields =
    state.mode === "edit" ? state.fields : createEmptyModuleFieldsValues();

  const [title, setTitle] = useState<TranslatedValue>(initialFields.title);
  const [description, setDescription] = useState<TranslatedValue>(
    initialFields.description,
  );
  const [color, setColor] = useState(initialFields.color);
  const [content, setContent] = useState<TranslatedValue>(
    initialFields.content,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Each field disables only itself while its own AI request is in flight
  // (ANA-109) -- these three flags are never fed back into another field's
  // `disabled`. They exist solely to keep Save disabled while any one of
  // them is unresolved: saving now would persist the pre-translation value,
  // and the AI result would then be silently lost once it lands after
  // `onClose` unmounts this component (PR review). Cancel stays unaffected
  // -- discarding the draft is always safe, in-flight request or not.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [contentBusy, setContentBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy || contentBusy;

  // The Lessons list shown in Module mode (ANA-111) -- local UI state
  // only, seeded from whatever order the caller provided (`state.lessons`,
  // itself local/mock data -- real Lesson loading/persistence is deferred
  // to ANA-116). Reordering, New Lesson, editing, and deleting all only
  // ever update this state directly; none of them makes a network
  // request, and none is included in `handlePrimaryAction`'s Module save
  // payload below.
  const [lessons, setLessons] = useState<MockLesson[]>(
    state.mode === "edit" ? (state.lessons ?? []) : [],
  );

  // Which Lesson editor is open, if any (ANA-115) -- `null` means Module
  // mode. `{ lessonId: null }` is New Lesson: a blank, id-less draft that
  // makes no request of its own (see lessons-panel.tsx) -- LessonEditor
  // itself decides create vs. update purely from whether this id is
  // present, so no separate temporary Lesson object is tracked here.
  // `{ lessonId: "..." }` opens an existing Lesson from local state. Edit
  // Module shows either the Module editor/Lessons list or the open
  // Lesson's editor, never both (the three-column layout from
  // ANA-111/ANA-114 is removed).
  const [lessonEditorTarget, setLessonEditorTarget] = useState<{
    lessonId: string | null;
  } | null>(null);
  const openLesson = lessonEditorTarget?.lessonId
    ? (lessons.find((lesson) => lesson.id === lessonEditorTarget.lessonId) ??
      null)
    : null;

  // Removes the given Lesson from local Lessons UI state only (ANA-115:
  // frontend-only, no Lesson API/Firestore write -- real Lesson delete is
  // deferred to ANA-116).
  function handleDeleteLesson(lesson: MockLesson) {
    setLessons((prev) =>
      prev.filter((candidate) => candidate.id !== lesson.id),
    );
  }

  // Appends the New Lesson draft as a fresh local Lesson (ANA-115:
  // frontend-only -- no Lesson document is ever created; real Lesson
  // create is deferred to ANA-116). `crypto.randomUUID()` mirrors
  // `createMockLesson`'s own id generation (mock-lessons.ts).
  function handleCreateLesson(fields: LessonFieldsValues) {
    setLessons((prev) => [...prev, { id: crypto.randomUUID(), ...fields }]);
  }

  // Updates the open Lesson in local Lessons UI state only (ANA-115:
  // frontend-only -- real Lesson update is deferred to ANA-116).
  function handleUpdateLesson(lessonId: string, fields: LessonFieldsValues) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { id: lessonId, ...fields } : lesson,
      ),
    );
  }

  async function handlePrimaryAction() {
    setSaveError(null);
    setIsSaving(true);

    try {
      const fields: ModuleFieldsValues = { title, description, color, content };

      if (state.mode === "create") {
        await onCreate(fields);
      } else {
        await onSave(state.id, fields);
      }

      onClose();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  const moduleForm = (
    <Stack gap="lg">
      {/* Title (ANA-98/ANA-99): AI Assistance and Translate with AI are both
          grounded in this Module's own Arabic Learning Material plus the
          Book's title/description/longDescription -- naming this Module,
          never restating the Book's own title or summarizing the Learning
          Material (see suggest-module-title.ts's base prompt). Every AI
          call here is Arabic-only end to end: context sent to the server is
          always this Module's Arabic value, never the bilingual `{ ar, en }`
          shape (ANA-99). */}
      <FormField
        label="Title"
        translatable
        value={title}
        onChange={setTitle}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "title",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleContent: content.ar ?? "",
        })}
        aiAssistance
        onAiAssist={({ text, instructions, context }) =>
          suggestModuleTitle({
            bookId: book.id,
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleContent: content.ar ?? "",
        })}
        onBusyChange={setTitleBusy}
      />

      {/* Description (ANA-98/ANA-99): AI Assistance and Translate with AI
          are both grounded in this Module's own Arabic Title and Learning
          Material plus the Book's title/description/longDescription --
          describing this specific Module within its Book, never restating
          the Book's own description (see suggest-module-description.ts's
          base prompt). */}
      <FormField
        label="Description"
        translatable
        value={description}
        onChange={setDescription}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "description",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleTitle: title.ar ?? "",
          moduleContent: content.ar ?? "",
        })}
        aiAssistance
        onAiAssist={({ text, instructions, context }) =>
          suggestModuleDescription({
            bookId: book.id,
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleTitle: title.ar ?? "",
          moduleContent: content.ar ?? "",
        })}
        onBusyChange={setDescriptionBusy}
      />

      {/* Content (ANA-98/ANA-99): this Module's Learning Material -- still
          loaded/saved through the Material persistence established in
          ANA-94, this field only gains AI context here. AI Assistance and
          Translate with AI are both grounded in this Module's own Arabic
          Title/Description plus the Book's title/description/
          longDescription, so a refinement or translation is framed by its
          owning Module, not just its Book. When AI Assistance runs on a
          Markdown selection (`isSelection`), the rest of this field's own
          current Arabic value is sent as `fullMaterial` -- surrounding
          context for the selected excerpt, never a second transformation
          target (ANA-99); omitted when there's no selection, since `text`
          already is the whole Learning Material in that case. */}
      <FormField
        label="Content"
        type="markdown"
        translatable
        value={content}
        onChange={setContent}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "content",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleTitle: title.ar ?? "",
          moduleDescription: description.ar ?? "",
        })}
        aiAssistance
        onAiAssist={({ text, instructions, isSelection, context }) =>
          assistLearningMaterial({
            bookId: book.id,
            text,
            additionalInstructions: instructions,
            fullMaterial: isSelection ? (content.ar ?? "") : undefined,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleTitle: title.ar ?? "",
          moduleDescription: description.ar ?? "",
        })}
        onBusyChange={setContentBusy}
      />

      <ColorField value={color} onChange={setColor} />

      {saveError && (
        <Alert color="red" role="alert">
          {saveError}
        </Alert>
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => void handlePrimaryAction()}
          loading={isSaving}
          disabled={aiBusy}
        >
          {state.mode === "create" ? "Save Module" : "Save changes"}
        </Button>
      </Group>
    </Stack>
  );

  // Create mode keeps its existing single-column layout unchanged. Edit
  // mode shows either the Module editor + Lessons list (Module mode) or
  // the open Lesson's own editor (Lesson mode, ANA-115) -- never both; the
  // three-column layout from ANA-111/ANA-114 is removed. `align="stretch"`
  // matches the two Module-mode columns to the form's own natural height,
  // the same pattern the Edit Book page already uses for its own
  // BookForm/ModulesPanel columns (see `[id]/edit/page.tsx`).
  if (state.mode === "create") {
    return moduleForm;
  }

  if (lessonEditorTarget) {
    return (
      <LessonEditor
        key={openLesson?.id ?? "new"}
        lesson={openLesson}
        onCreate={handleCreateLesson}
        onUpdate={handleUpdateLesson}
        onBack={() => setLessonEditorTarget(null)}
      />
    );
  }

  return (
    <Flex gap="lg" direction={{ base: "column", md: "row" }} align="stretch">
      <Box style={{ flex: 1, minWidth: 0 }}>{moduleForm}</Box>
      <Box w={{ base: "100%", md: 260 }} style={{ flexShrink: 0 }}>
        <LessonsPanel
          lessons={lessons}
          onLessonsChange={setLessons}
          onEditLesson={(lesson) =>
            setLessonEditorTarget({ lessonId: lesson.id })
          }
          onDeleteLesson={handleDeleteLesson}
          onNewLesson={() => setLessonEditorTarget({ lessonId: null })}
        />
      </Box>
    </Flex>
  );
}
