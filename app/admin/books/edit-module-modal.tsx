"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import { ColorField } from "@/components/ui/color-field";
import { FormField } from "@/components/ui/form-field";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Book } from "@/lib/books/types";
import type { Lesson } from "@/lib/lessons/types";
import styles from "./edit-module-modal.module.css";
import {
  assistLearningMaterial,
  suggestModuleDescription,
  suggestModuleTitle,
} from "./import-source/ai-assist-client";
import { translateModuleField } from "./import-source/translate-client";
import { LessonsPanel } from "./lessons-panel";
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
 * persists through the backend instead of only updating local state. */
export type EditModuleModalState =
  { mode: "create" } | { mode: "edit"; id: string; fields: ModuleFieldsValues };

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
  /** This Module's Lessons, in their persisted order (ANA-111) -- only
   * rendered in edit mode, since a Module being created has no real id yet
   * to attach Lessons to. The owning Edit Book page loads these (keyed off
   * whichever Module this modal currently has open); this modal owns no
   * fetching of its own, matching how `fields`/`book` already arrive fully
   * loaded from the caller. */
  lessons?: Lesson[];
  lessonsLoading?: boolean;
  /** Set when the Lessons lookup itself failed -- blocks the Lessons column
   * with an error instead of rendering a list that might be missing rows. */
  lessonsLoadError?: string | null;
  /** Fired with the full reordered array once a drag actually changes the
   * order. The owning page persists this through the existing Lesson/Module
   * reorder flow. */
  onReorderLessons?: (lessons: Lesson[]) => void;
  reorderLessonsDisabled?: boolean;
  /** Fired when Add lesson is clicked -- the owning page creates a real
   * Lesson from the existing/default Lesson fields; this modal never
   * inserts a client-generated Lesson into `lessons` itself. */
  onAddLesson?: () => void;
  addLessonDisabled?: boolean;
  /** A failed reorder/create request, surfaced inline in the Lessons column
   * (via LessonsPanel's own `error` slot) -- unlike `lessonsLoadError`, this
   * never blocks the list itself. */
  lessonsActionError?: string | null;
}

// Top-level modal (ANA-91) opened from the Edit Book screen's Modules panel
// -- deliberately a sibling of, not nested inside, the Module Builder modal
// (ImportSourceModal). Reused for both Add Module (create mode) and the
// pencil action (edit mode) rather than duplicating the form (ANA-94) --
// only the title, primary action label, and which callback Save invokes
// differ between the two. Edit mode also grows a Lessons column beside the
// form (ANA-111) -- widened close to Module Builder's own near-full-width
// treatment so the form and the Lessons list both keep comfortable room;
// create mode keeps its original, narrower `size="lg"` since it has nothing
// else to show yet.
export function EditModuleModal({
  state,
  book,
  onClose,
  onCreate,
  onSave,
  lessons = [],
  lessonsLoading = false,
  lessonsLoadError = null,
  onReorderLessons = () => {},
  reorderLessonsDisabled = false,
  onAddLesson = () => {},
  addLessonDisabled = false,
  lessonsActionError = null,
}: EditModuleModalProps) {
  const isMobile = useMediaQuery("(max-width: 768px)", false);
  const isEditWithLessons = state?.mode === "edit";

  return (
    <Modal
      opened={state !== null}
      onClose={onClose}
      title={state?.mode === "create" ? "Add Module" : "Edit Module"}
      size={
        !isEditWithLessons
          ? "lg"
          : isMobile
            ? "100%"
            : "min(1400px, calc(100vw - 48px))"
      }
      xOffset={isEditWithLessons && !isMobile ? "24px" : undefined}
      fullScreen={isEditWithLessons && isMobile}
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
          lessons={lessons}
          lessonsLoading={lessonsLoading}
          lessonsLoadError={lessonsLoadError}
          onReorderLessons={onReorderLessons}
          reorderLessonsDisabled={reorderLessonsDisabled}
          onAddLesson={onAddLesson}
          addLessonDisabled={addLessonDisabled}
          lessonsActionError={lessonsActionError}
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
  lessons,
  lessonsLoading,
  lessonsLoadError,
  onReorderLessons,
  reorderLessonsDisabled,
  onAddLesson,
  addLessonDisabled,
  lessonsActionError,
}: {
  state: EditModuleModalState;
  book: Book;
  onClose: () => void;
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  onSave: (id: string, fields: ModuleFieldsValues) => Promise<void>;
  lessons: Lesson[];
  lessonsLoading: boolean;
  lessonsLoadError: string | null;
  onReorderLessons: (lessons: Lesson[]) => void;
  reorderLessonsDisabled: boolean;
  onAddLesson: () => void;
  addLessonDisabled: boolean;
  lessonsActionError: string | null;
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

  const isEditWithLessons = state.mode === "edit";

  const formFields = (
    <>
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
    </>
  );

  // Edit mode grows a Lessons column beside the form, plus a placeholder
  // reserving space for the future Lesson editor (ANA-111) -- create mode
  // has no real Module id yet to attach Lessons to, so it keeps the
  // original single-column layout untouched.
  if (!isEditWithLessons) {
    return <Stack gap="lg">{formFields}</Stack>;
  }

  return (
    <Flex gap="xl" align="stretch" direction={{ base: "column", md: "row" }}>
      <Stack gap="lg" className={styles.formColumn}>
        {formFields}
      </Stack>
      <Box className={styles.lessonsColumn}>
        {lessonsLoading ? (
          <LessonsColumnSkeleton />
        ) : lessonsLoadError ? (
          <Alert color="red">{lessonsLoadError}</Alert>
        ) : (
          <LessonsPanel
            lessons={lessons}
            onReorderLessons={onReorderLessons}
            reorderDisabled={reorderLessonsDisabled}
            onAddLesson={onAddLesson}
            addDisabled={addLessonDisabled}
            error={lessonsActionError}
          />
        )}
      </Box>
      <Box className={styles.placeholderColumn}>
        <Box className={styles.placeholder}>
          <Text c="dimmed">Select a lesson to edit.</Text>
        </Box>
      </Box>
    </Flex>
  );
}

// Approximates LessonsPanel/ItemList's own card chrome while the owning page's
// Lessons SWR fetch is in flight, matching ModulesPanelSkeleton's approach on
// Edit Book (ANA-104) -- keeps the modal from jumping once the real list
// arrives.
function LessonsColumnSkeleton() {
  return (
    <Box
      role="status"
      aria-label="Loading lessons"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 12,
      }}
    >
      <Box
        p="md"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
        aria-hidden="true"
      >
        <Skeleton height={14} width={70} />
        <Skeleton height={11} width={90} mt={6} />
      </Box>
      <Stack gap="xs" p="md" style={{ flex: 1 }} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height={40} radius={12} />
        ))}
      </Stack>
      <Box
        p="md"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
        }}
        aria-hidden="true"
      >
        <Skeleton height={36} radius={8} />
      </Box>
    </Box>
  );
}
