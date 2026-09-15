"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";

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
import { LessonForm } from "./lesson-form";
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
 * of scope for this task (ANA-110); omitted (or empty) shows the Lessons
 * list's own empty state. */
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
      // Edit mode's three-column layout (Module form, Lessons list, Lesson
      // placeholder, ANA-111) needs materially more width than the
      // single-column form Create mode still uses -- capped against the
      // viewport the same way Module Builder's own wide modal is
      // (import-source-modal.tsx), rather than a fixed size that would
      // overflow a narrow viewport.
      size={state?.mode === "edit" ? "min(1100px, calc(100vw - 48px))" : "lg"}
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

  // The Lessons list shown in edit mode's middle column (ANA-111) -- local
  // UI state only, seeded from whatever order the caller provided
  // (`state.lessons`, itself local/mock data -- real Lesson loading is out
  // of scope, ANA-110). Reordering and Add Lesson only ever update this
  // state through LessonsPanel's own `onLessonsChange`; neither makes a
  // network request, and neither is included in `handlePrimaryAction`'s
  // save payload below.
  const [lessons, setLessons] = useState<MockLesson[]>(
    state.mode === "edit" ? (state.lessons ?? []) : [],
  );

  // The Lesson currently selected in the Lessons list, if any (ANA-114) --
  // local UI state only, mirroring `lessons` itself. Rendering its form (or
  // the placeholder) is derived from this plus `lessons` below rather than
  // holding a second, potentially-stale copy of the selected Lesson's own
  // fields; edits from LessonForm are applied back into `lessons` in place
  // through `handleLessonChange`.
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  // Merges a single-field patch onto whichever Lesson `id` currently looks
  // like in `lessons` (PR review, ANA-114) -- never onto a whole Lesson
  // object LessonForm itself constructed, which could close over a stale
  // snapshot from before a still-pending Translate with AI request
  // resolves. Using the functional `setLessons` form (not `lessons` from
  // this closure) is what makes this correct even when two patches for the
  // same Lesson are in flight and resolve out of order -- each always
  // merges onto the *latest* state, not onto whatever `lessons` looked like
  // when its own request started.
  function handleLessonChange(id: string, patch: Partial<MockLesson>) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === id ? { ...lesson, ...patch } : lesson,
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
  // mode gains the three-column layout (ANA-111): Module form, Lessons
  // list, and the selected Lesson's basic-fields form (ANA-114) once one is
  // selected -- the dashed placeholder otherwise. Configuration and the
  // Questions section are a later task (ANA-110). `align="stretch"` matches
  // all three columns to the form's own natural height, the same pattern
  // the Edit Book page already uses for its own BookForm/ModulesPanel
  // columns (see `[id]/edit/page.tsx`).
  if (state.mode === "create") {
    return moduleForm;
  }

  return (
    <Flex gap="lg" direction={{ base: "column", md: "row" }} align="stretch">
      <Box style={{ flex: 1, minWidth: 0 }}>{moduleForm}</Box>
      <Box w={{ base: "100%", md: 260 }} style={{ flexShrink: 0 }}>
        <LessonsPanel
          lessons={lessons}
          onLessonsChange={setLessons}
          selectedLessonId={selectedLessonId}
          onSelectLesson={(lesson) => setSelectedLessonId(lesson.id)}
        />
      </Box>
      {/* Wider than a plain `flex: 1` third of the row (ANA-114 PR review)
          -- the Lesson form's own "One-line description" label is longer
          than any Module field's label, and at the narrower width a plain
          even split left it overlapping TranslatableFieldHeader's
          absolutely-positioned language switcher. A fixed width, matching
          the Lessons list's own fixed column, guarantees enough room
          regardless of viewport rather than depending on how the Module
          form's own flex-basis happens to shake out. */}
      <Box w={{ base: "100%", md: 300 }} style={{ flexShrink: 0 }}>
        {selectedLesson ? (
          <LessonForm
            key={selectedLesson.id}
            lesson={selectedLesson}
            onChange={handleLessonChange}
          />
        ) : (
          <Box
            style={{
              height: "100%",
              minHeight: 280,
              border: "1px dashed var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 16,
            }}
          >
            <Text size="sm" c="dimmed">
              Select a lesson to edit.
            </Text>
          </Box>
        )}
      </Box>
    </Flex>
  );
}
