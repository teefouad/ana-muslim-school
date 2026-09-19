"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  Loader,
  Skeleton,
  Stack,
  Title,
} from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import {
  isSameTranslatedValue,
  type TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Book } from "@/lib/books/types";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import type { Lesson } from "@/lib/lessons/types";
import type { Question } from "@/lib/questions/types";
import {
  assistLearningMaterial,
  suggestModuleDescription,
  suggestModuleTitle,
} from "./import-source/ai-assist-client";
import {
  createLesson,
  deleteLesson,
  updateLesson,
} from "./import-source/lessons-client";
import { translateModuleField } from "./import-source/translate-client";
import { fetchJson } from "./fetch-json";
import { LessonEditor } from "./lesson-editor";
import {
  toLessonCreateFields,
  toLessonPatchFields,
  type LessonFieldsValues,
} from "./lesson-fields";
import { LessonsPanel } from "./lessons-panel";
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";
import type { ModuleQuestionGroup } from "./question-fields";
import { saveLessonQuestions } from "./questions-client";
import { ArrowLeft } from "lucide-react";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Upserts freshly created/updated Questions (ANA-119) into the Module's
 * cached Question list by id -- keeps the Questions SWR cache current for
 * this session without waiting on its own background revalidation, the
 * same "write the real result in, then let SWR revalidate" contract
 * `mutateLessons` already uses for Lessons. */
function mergeQuestions(current: Question[], saved: Question[]): Question[] {
  const byId = new Map(current.map((question) => [question.id, question]));
  for (const question of saved) {
    byId.set(question.id, question);
  }
  return Array.from(byId.values());
}

const LESSONS_SKELETON_ROW_COUNT = 3;

/** Fixed at the `md`+ breakpoint only (ANA-117) -- Module mode's editor +
 * Lessons list and Lesson mode's own editor render this same height
 * regardless of which is taller, so switching between them never resizes
 * the container itself (each mode's own wrapper below sets `overflowY:
 * "auto"`). Left at `auto` below `md`, where the two columns already stack
 * instead of sitting side by side -- constraining height there would fight
 * that stacked layout's own natural scroll instead of stabilizing anything.
 * Used by the modal always, and by the drawer's own Lesson mode (ANA-121) --
 * narrow Module mode uses its own auto-height layout instead (see
 * `NARROW_LESSONS_PANEL_HEIGHT` below), since it stacks a second column that
 * would otherwise need a real height of its own to size against. */
const EDIT_MODE_CONTENT_HEIGHT = { base: "auto", md: 544 } as const;

/** Narrow layout's Lessons column has no ancestor Flex row to stretch
 * against for its height the way the wide layout's does (ANA-121 PR review
 * -- see the narrow-mode comment further down), so it gets one concrete
 * pixel height instead, for `LessonsPanelSkeleton`/`LessonsPanel`'s own
 * `height: "100%"` to resolve against regardless of how tall the Module
 * fields above it happen to be. Picked to comfortably show a few Lesson
 * rows without making the drawer's own body scroll excessively before
 * reaching Save. */
const NARROW_LESSONS_PANEL_HEIGHT = 320;

// Approximates LessonsPanel/ItemList's own card chrome (ANA-116) --
// mirrors `[id]/edit/page.tsx`'s `ModulesPanelSkeleton`, sized for this
// panel's own narrower column instead. Shown only for the initial Lessons
// load of a Module being edited; swapped for the real panel as soon as
// `GET .../lessons` resolves.
function LessonsPanelSkeleton() {
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
        <Skeleton height={14} width={60} />
        <Skeleton height={11} width={70} mt={6} />
      </Box>
      <Stack gap="xs" p="md" style={{ flex: 1 }} aria-hidden="true">
        {Array.from({ length: LESSONS_SKELETON_ROW_COUNT }).map((_, index) => (
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

/** `"create"` opens the editor empty, with Save Module as its primary action
 * (ANA-94) -- clicking Add Module no longer inserts anything into the
 * Module list itself; that only happens once this body's own backend create
 * request succeeds (see `[id]/edit/page.tsx`'s `handleCreateModule`).
 * `"edit"` seeds it from an existing, real Module's current fields, primary
 * action Save changes -- unchanged from ANA-91 except that saving now
 * persists through the backend instead of only updating local state. This
 * Module's Lessons (ANA-111) are no longer passed in -- `edit` mode loads
 * them itself via the existing Lesson list API, keyed off `book.id`/`id`
 * (ANA-116); create mode never shows a Lessons list at all (there is no
 * Module id yet to load Lessons for).
 *
 * Shared between the Edit Module modal (`edit-module-modal.tsx`) and the
 * Edit Module drawer (`edit-module-drawer.tsx`, ANA-121) -- only the drawer
 * ever constructs an `"edit"` value; the drawer has no create flow of its
 * own (Add Module stays on the modal), but the type itself stays the same
 * union either container can pass so this body's own mode-branching logic
 * never has to know which container it's mounted in. */
export type ModuleEditorState =
  | { mode: "create" }
  | {
      mode: "edit";
      id: string;
      fields: ModuleFieldsValues;
    };

export interface ModuleEditorBodyProps {
  state: ModuleEditorState;
  /** The owning Book -- its `id` is what every AI action here sends as
   * `bookId` (the server always reloads the Book fresh from it for its own
   * Book-level context, never trusting client-sent Book fields, ANA-85),
   * and its Title/Description/Long description are read directly by this
   * body's own AI context builders (ANA-98) -- the Edit Book page already
   * has the full `Book` loaded, so this needs no second fetch. */
  book: Book;
  onClose: () => void;
  /** Called with the current field values when Save Module is clicked in
   * create mode. Awaited -- resolving creates the Module through the
   * backend and closes the container; rejecting keeps it open and shows the
   * error, without ever calling `onClose` itself (ANA-94: "only add the
   * Module to the list after creation succeeds"). Optional because the
   * drawer (ANA-121) never opens in create mode and so never needs to
   * supply one -- this branch of `handlePrimaryAction` below is
   * unreachable for a container whose `state` is always `"edit"`. */
  onCreate?: (fields: ModuleFieldsValues) => Promise<void>;
  /** Called with the current field values when Save changes is clicked in
   * edit mode. Same awaited resolve/reject contract as `onCreate`.
   * `lessonsOrder` (ANA-117) is this Module's current Lesson display order
   * -- a pending drag-and-drop reorder as its exact id list, or `null` when
   * the Lessons list was never reordered this session, in which case the
   * caller must leave the Module's persisted Lesson order untouched rather
   * than resend the order it happened to load with. */
  onSave: (
    id: string,
    fields: ModuleFieldsValues,
    lessonsOrder: string[] | null,
  ) => Promise<void>;
  requestCloseRef: MutableRefObject<() => void>;
  /** How much horizontal room the owning container gives this body
   * (ANA-121). `"wide"` (the default, and the only value the modal ever
   * passes -- its own rendered output is unchanged by this prop's
   * existence) keeps Module mode's Module-editor+Lessons-list layout
   * side-by-side from the `md` viewport breakpoint up, same as before this
   * prop existed. `"narrow"` (the drawer's fixed 500px width, ANA-121) always
   * stacks that same content in one column instead -- the modal's `md`
   * breakpoint alone can't tell the two containers apart, since a viewport
   * wide enough to satisfy it doesn't mean *this* body's own container is:
   * a 500px drawer full-height on a wide desktop viewport still has no room
   * for a 300px Lessons column next to the Module form. Nothing else about
   * either mode's content changes between the two values -- the goal is a
   * different presentation container, not a redesigned editor. */
  layout?: "wide" | "narrow";
}

export function ModuleEditorBody({
  state,
  book,
  onClose,
  onCreate,
  onSave,
  requestCloseRef,
  layout = "wide",
}: ModuleEditorBodyProps) {
  const isNarrow = layout === "narrow";

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
  const [isPublished, setIsPublished] = useState(initialFields.isPublished);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Gates dismissing the whole container (Cancel, X, Escape, backdrop/
  // outside click) behind a "Discard unsaved changes?" confirmation -- see
  // `isDirty`/`handleRequestClose` below (PR review).
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

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

  // This Module's real Lessons, loaded via the existing Lesson list API and
  // SWR/data-loading pattern (ANA-116), never a second persistence
  // architecture -- `null` while in create mode (there is no Module id yet
  // to load Lessons for), matching Materials' own `book ? ... : null`
  // conditional-key convention (`[id]/edit/page.tsx`).
  const lessonsKey =
    state.mode === "edit"
      ? `/api/v1/books/${book.id}/modules/${state.id}/lessons`
      : null;
  const {
    data: lessonsData,
    error: lessonsError,
    mutate: mutateLessons,
  } = useSWR<{ data: Lesson[] }>(lessonsKey, fetchJson, {
    shouldRetryOnError: false,
  });
  const lessonsLoading = lessonsKey !== null && !lessonsData && !lessonsError;
  const serverLessons: Lesson[] = lessonsData?.data ?? [];

  // Every Question currently defined for this Module (ANA-119), loaded the
  // same way/at the same time as its Lessons -- the Lesson editor's own
  // Questions configuration needs the full list to seed a Lesson's
  // `questions` (an ordered id array) with real Question content when it
  // opens (see lesson-fields.ts's `toLessonFieldsValues`).
  const questionsKey =
    state.mode === "edit"
      ? `/api/v1/books/${book.id}/modules/${state.id}/questions`
      : null;
  const {
    data: questionsData,
    error: questionsError,
    mutate: mutateQuestions,
  } = useSWR<{ data: Question[] }>(questionsKey, fetchJson, {
    shouldRetryOnError: false,
  });
  const questionsLoading =
    questionsKey !== null && !questionsData && !questionsError;
  // True only for a first-load failure with no data ever received (PR
  // review) -- SWR keeps whatever `data` it last had on a *later* failed
  // revalidation, so this stays false once Questions have loaded at least
  // once, matching Lessons' own non-blocking failed-refresh treatment
  // below. Distinguishing the two matters here specifically because
  // `moduleQuestions` seeds `Lesson.questions`' hydration (see
  // `toLessonFieldsValues`): falling back to `[]` on a genuine first-load
  // failure would make an existing Lesson's own Question references look
  // like they don't exist, and saving any other field would then PATCH
  // `questions: []`, detaching every one of them.
  const questionsUnavailable = questionsError !== undefined && !questionsData;
  const moduleQuestions: Question[] = questionsData?.data ?? [];

  // Every Question already defined in every Module *before* this one in the
  // Book's own Module order (ANA-120) -- the read boundary Insert's Question
  // Bank picker uses to also offer previous-Module Questions (the School
  // schema requires `Lesson.questions` ids to resolve under the Lesson's
  // own Module, so a previous-Module selection is copied into a new local
  // draft instead of referencing its id directly; see
  // `copyQuestionFromPreviousModule`, question-fields.ts). Reuses the
  // Book-wide, per-Book-cached endpoint from ANA-108 -- it already returns
  // every Module's Questions grouped and ordered per `Book.modules` in one
  // request, rather than a fetch per previous Module. Deliberately
  // non-blocking on failure/while loading (unlike `moduleQuestions` above):
  // nothing here is required to open or save a Lesson, so Insert simply
  // offers fewer previous-Module results rather than the whole editor
  // gating on it.
  const bookQuestionsKey =
    state.mode === "edit" ? `/api/v1/books/${book.id}/questions` : null;
  const { data: bookQuestionsData } = useSWR<{ data: ModuleQuestionGroup[] }>(
    bookQuestionsKey,
    fetchJson,
    { shouldRetryOnError: false },
  );
  const currentModuleIndex =
    state.mode === "edit" ? book.modules.indexOf(state.id) : -1;
  const previousModuleQuestions: ModuleQuestionGroup[] = (
    bookQuestionsData?.data ?? []
  ).filter(
    (group) => book.modules.indexOf(group.moduleId) < currentModuleIndex,
  );

  // A pending drag-and-drop reorder, not yet persisted -- mirrors
  // `[id]/edit/page.tsx`'s own `moduleOrderDraft` for `Book.modules`.
  // Dragging only ever updates this local draft; it's persisted, alongside
  // this Module's other fields, through the existing Module PATCH when Save
  // changes is clicked (ANA-117) -- see `handlePrimaryAction` below and
  // `handleSaveModule` in `[id]/edit/page.tsx`, never a separate reorder
  // request of its own.
  const [lessonOrderDraft, setLessonOrderDraft] = useState<string[] | null>(
    null,
  );

  // If the server's Lesson *set* changed since the draft was built (a
  // create/update/delete elsewhere revalidated this same SWR key), the
  // draft can no longer be trusted to cover every current Lesson -- fall
  // back to the fresh server order, the same staleness guard the Modules
  // panel already uses for `Book.modules`.
  if (
    lessonsData &&
    lessonOrderDraft &&
    !isValidReorder(
      lessonOrderDraft,
      serverLessons.map((lesson) => lesson.id),
    )
  ) {
    setLessonOrderDraft(null);
  }

  const lessons: Lesson[] = lessonOrderDraft
    ? lessonOrderDraft
        .map((id) => serverLessons.find((lesson) => lesson.id === id))
        .filter((lesson): lesson is Lesson => lesson !== undefined)
    : serverLessons;

  // Whether this draft (any Module field, or a pending Lesson reorder) has
  // diverged from what it was seeded with -- mirrors LessonEditor's own
  // `isDirty` (lesson-editor.tsx). Drives `handleRequestClose` below: a
  // reorder that's never been saved is exactly as much unsaved work as an
  // edited Title (PR review), so it gates dismissing the whole container
  // the same way.
  const isDirty =
    !isSameTranslatedValue(title, initialFields.title) ||
    !isSameTranslatedValue(description, initialFields.description) ||
    color !== initialFields.color ||
    !isSameTranslatedValue(content, initialFields.content) ||
    isPublished !== initialFields.isPublished ||
    lessonOrderDraft !== null;

  function handleReorderLessons(reordered: Lesson[]) {
    if (
      !isValidReorder(
        reordered.map((lesson) => lesson.id),
        lessons.map((lesson) => lesson.id),
      )
    ) {
      return;
    }

    setLessonOrderDraft(reordered.map((lesson) => lesson.id));
  }

  // Which Lesson editor is open, if any (ANA-115) -- `null` means Module
  // mode. `{ lessonId: null }` is New Lesson: a blank, id-less draft that
  // makes no request of its own (see lessons-panel.tsx) -- LessonEditor
  // itself decides create vs. update purely from whether this id is
  // present, so no separate temporary Lesson object is tracked here.
  // `{ lessonId: "..." }` opens an existing, real Lesson. Edit Module shows
  // either the Module editor/Lessons list or the open Lesson's editor,
  // never both (the three-column layout from ANA-111/ANA-114 is removed).
  const [lessonEditorTarget, setLessonEditorTarget] = useState<{
    lessonId: string | null;
  } | null>(null);
  const openLesson = lessonEditorTarget?.lessonId
    ? (lessons.find((lesson) => lesson.id === lessonEditorTarget.lessonId) ??
      null)
    : null;

  // Persists a new Lesson through the existing Lesson create API (ANA-116)
  // -- exactly one POST per call (LessonEditor never retries implicitly).
  // Updates the Lessons SWR cache directly with the real, backend-returned
  // Lesson before/alongside revalidating (`revalidate: true`) so this
  // resolves, and the Lessons list reflects the new Lesson, without waiting
  // on a second round-trip -- and so a background revalidation failure can
  // never retroactively make this successful write look like it failed
  // (the create's own promise settles here, independent of that
  // fire-and-forget revalidation).
  async function handleCreateLesson(
    fields: LessonFieldsValues,
    onQuestionSaved: (key: string, question: Question) => void,
  ) {
    if (state.mode !== "edit") {
      return;
    }

    // Every local Question draft/edit is persisted first (ANA-119: new
    // drafts POST, existing linked Questions PATCH), so the Lesson create
    // request below can carry their real, final ids in `questions` -- a
    // failure here throws before any Lesson request is made, keeping the
    // Lesson editor open with the draft intact (see LessonEditor's own
    // `handleSave`). Each individual Question success is promoted into
    // both LessonEditor's own draft (`onQuestionSaved`, PR review) and this
    // Questions SWR cache immediately, not just after every save settles --
    // so a Question already created here is never re-POSTed by a retry
    // after a later Question or this Lesson create itself fails.
    const savedQuestions = await saveLessonQuestions(
      book.id,
      state.id,
      fields.questions,
      moduleQuestions,
      (key, question) => {
        onQuestionSaved(key, question);
        void mutateQuestions(
          (current) => ({
            data: mergeQuestions(current?.data ?? [], [question]),
          }),
          { revalidate: false },
        );
      },
    );

    const created = await createLesson(
      book.id,
      state.id,
      toLessonCreateFields(
        fields,
        savedQuestions.map((question) => question.id),
      ),
    );

    setLessonOrderDraft(null);
    void mutateLessons(
      (current) => ({ data: [...(current?.data ?? []), created] }),
      { revalidate: true },
    );
    void mutateQuestions(
      (current) => ({
        data: mergeQuestions(current?.data ?? [], savedQuestions),
      }),
      { revalidate: true },
    );
  }

  // Persists an existing Lesson's edited fields through the existing Lesson
  // PATCH API (ANA-116) -- sends only the five fields this editor owns
  // (`toLessonPatchFields`), so hidden fields (`reward`/`duration`/
  // `videoURL`/`azkar`/`questions`/`isLocked`) are left unchanged by the
  // endpoint's own "omitted field" semantics. Same cache-update-then-
  // revalidate contract as `handleCreateLesson`.
  async function handleUpdateLesson(
    lessonId: string,
    fields: LessonFieldsValues,
    onQuestionSaved: (key: string, question: Question) => void,
  ) {
    if (state.mode !== "edit") {
      return;
    }

    // See handleCreateLesson's identical comment -- persists every local
    // Question draft/edit first (ANA-119), promoting each one into
    // LessonEditor's own draft and this Questions SWR cache the moment it
    // succeeds, so the Lesson PATCH below carries their real, final ids.
    const savedQuestions = await saveLessonQuestions(
      book.id,
      state.id,
      fields.questions,
      moduleQuestions,
      (key, question) => {
        onQuestionSaved(key, question);
        void mutateQuestions(
          (current) => ({
            data: mergeQuestions(current?.data ?? [], [question]),
          }),
          { revalidate: false },
        );
      },
    );

    const updated = await updateLesson(
      book.id,
      state.id,
      lessonId,
      toLessonPatchFields(
        fields,
        savedQuestions.map((question) => question.id),
      ),
    );

    void mutateLessons(
      (current) => ({
        data: (current?.data ?? []).map((lesson) =>
          lesson.id === lessonId ? updated : lesson,
        ),
      }),
      { revalidate: true },
    );
    void mutateQuestions(
      (current) => ({
        data: mergeQuestions(current?.data ?? [], savedQuestions),
      }),
      { revalidate: true },
    );
  }

  // Persists the deletion of a real Lesson through the existing Lesson
  // DELETE API (ANA-116) -- rejecting propagates to LessonsPanel, which
  // keeps the row visible and shows the error (see lessons-panel.tsx).
  // Drops only the deleted Lesson's id from a pending reorder draft, the
  // same targeted-update the Modules panel's own `handleDeleteModule` uses
  // for `Book.modules` (`[id]/edit/page.tsx`).
  async function handleDeleteLesson(lesson: Lesson) {
    if (state.mode !== "edit") {
      return;
    }

    await deleteLesson(book.id, state.id, lesson.id);

    setLessonOrderDraft((draft) =>
      draft ? draft.filter((id) => id !== lesson.id) : draft,
    );
    void mutateLessons(
      (current) => ({
        data: (current?.data ?? []).filter(
          (candidate) => candidate.id !== lesson.id,
        ),
      }),
      { revalidate: true },
    );
  }

  // Funnels every way of dismissing the container (Cancel, X, Escape,
  // backdrop/outside click) through one dirty check (PR review), mirroring
  // Module Builder's own `handleClose` (import-source-modal.tsx). A save
  // already in flight is never raced -- dismissing is simply ignored until
  // it settles, same as that precedent (Cancel is separately disabled for
  // the same window via its own `disabled={isSaving}` below; this covers
  // X/Escape/backdrop, which aren't).
  function handleRequestClose() {
    if (isSaving) {
      return;
    }

    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }

    onClose();
  }

  // Keeps the owning container's Modal/Drawer-dismiss bridge pointed at
  // this render's own `handleRequestClose` -- an effect, not a direct
  // render-time assignment, since Mantine only ever reads this ref from a
  // later, separate event (the user actually dismissing the container), by
  // which point the effect has already run.
  useEffect(() => {
    requestCloseRef.current = handleRequestClose;
  });

  async function handlePrimaryAction() {
    setSaveError(null);
    setIsSaving(true);

    try {
      const fields: ModuleFieldsValues = {
        title,
        description,
        color,
        content,
        isPublished,
      };

      if (state.mode === "create") {
        await onCreate?.(fields);
      } else {
        await onSave(state.id, fields, lessonOrderDraft);

        // PR review: promote the just-persisted Lesson order into the
        // Lessons SWR cache immediately, before this container closes --
        // otherwise reopening the same Module lets `useSWR` synchronously
        // render the still-stale pre-save cached order before its
        // background revalidation returns the newly persisted one (a
        // visible flash). `lessons` is already this exact order (the local
        // reorder draft layered onto the server list) whenever a reorder
        // was actually pending; still revalidates in the background for
        // eventual correctness against any concurrent server-side change.
        if (lessonOrderDraft) {
          void mutateLessons({ data: lessons }, { revalidate: true });
        }
      }

      onClose();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // Split from the footer below (ANA-117) so edit mode can pin Cancel/Save
  // outside the fixed-height, internally-scrollable region created further
  // down -- the footer must stay visible without scrolling, not be content
  // that can scroll out of view along with the fields above it.
  const moduleFormFields = (
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

      {/* Published + Color (ANA-117 PR review): a single responsive row,
          Published on the left and Color on the right -- matching Book
          form's own Locked/Published row (book-form.tsx), stacking only on
          narrow screens. Published reflects and edits this Module's own
          persisted `isPublished`, included in both create and update
          Module persistence (module-fields.ts). */}
      <Group align="flex-end" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <ToggleCard
            label="Published"
            checked={isPublished}
            onChange={setIsPublished}
          />
        </div>
        <div style={{ flex: 2 }}>
          <ColorField value={color} onChange={setColor} />
        </div>
      </Group>

      {saveError && (
        <Alert color="red" role="alert">
          {saveError}
        </Alert>
      )}
    </Stack>
  );

  const moduleFormFooter = (
    <Group justify="flex-end" gap="sm">
      <Button
        variant="default"
        onClick={handleRequestClose}
        disabled={isSaving}
      >
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
  );

  const lessonsPanel = (
    <LessonsPanel
      lessons={lessons}
      onLessonsChange={handleReorderLessons}
      onEditLesson={(lesson) => setLessonEditorTarget({ lessonId: lesson.id })}
      onDeleteLesson={handleDeleteLesson}
      onNewLesson={() => setLessonEditorTarget({ lessonId: null })}
    />
  );

  // Create mode keeps its existing single-column layout unchanged. Edit
  // mode shows either the Module editor + Lessons list (Module mode) or
  // the open Lesson's own editor (Lesson mode, ANA-115) -- never both; the
  // three-column layout from ANA-111/ANA-114 is removed. `align="stretch"`
  // matches the two Module-mode columns to the shared `EDIT_MODE_CONTENT_
  // HEIGHT` below, the same pattern the Edit Book page already uses for its
  // own BookForm/ModulesPanel columns (see `[id]/edit/page.tsx`). Both
  // modes are pinned to that same fixed height (ANA-117) so switching
  // between them never grows/shrinks the container itself -- only the
  // fields area scrolls internally when its content is taller (`overflowY:
  // "auto"`); the footer (Module mode's Cancel/Save, Lesson mode's own Save
  // via `LessonEditor`'s internal layout) stays pinned outside that scroll
  // region, never itself scrolled out of view.
  //
  // Module mode's Module-editor/Lessons-list split only ever sits side by
  // side when `layout` is `"wide"` (ANA-121) -- the drawer's fixed 500px
  // width has no room for a 300px Lessons column next to the Module form
  // regardless of the viewport's own `md` breakpoint, so `"narrow"` always
  // stacks the two instead. Nothing else here differs between the two.
  const modeContent =
    state.mode === "create" ? (
      <Stack gap="lg">
        {moduleFormFields}
        {moduleFormFooter}
      </Stack>
    ) : lessonEditorTarget ? (
      <Box h={EDIT_MODE_CONTENT_HEIGHT} style={{ overflowY: "hidden" }}>
        {questionsLoading ? (
          // This Module's Questions (needed to seed an existing Lesson's
          // `questions`, see lesson-fields.ts's `toLessonFieldsValues`)
          // load alongside its Lessons and have almost always already
          // resolved by the time Edit/New Lesson is clicked -- this only
          // ever shows on a genuinely slow first load.
          <Stack align="center" justify="center" h="100%">
            <Loader />
          </Stack>
        ) : questionsUnavailable && lessonEditorTarget.lessonId !== null ? (
          // Blocking (PR review): unlike a failed *background* refresh
          // (handled below, non-blocking), a genuine first-load failure
          // here means `moduleQuestions` is `[]` with no real data behind
          // it -- opening this existing Lesson's editor would hydrate
          // `questions` as empty (see `toLessonFieldsValues`), and saving
          // any other field would then PATCH `questions: []`, silently
          // detaching every one of its real Questions. New Lesson
          // (`lessonId === null`) has nothing to hydrate, so it's
          // unaffected by this gate and still opens normally below.
          <Stack align="center" justify="center" h="100%" gap="sm">
            <Alert color="red" role="alert">
              {questionsError?.message}
            </Alert>
            <Button variant="default" onClick={() => void mutateQuestions()}>
              Retry
            </Button>
          </Stack>
        ) : (
          <Stack gap="sm" style={{ height: "100%" }}>
            {questionsError && (
              // Non-blocking: Questions have loaded at least once here
              // (see `questionsUnavailable`'s own doc), so `moduleQuestions`
              // still reflects that last good list -- a failed background
              // revalidation only ever surfaces as a banner, matching
              // Lessons' own failed-refresh treatment below.
              <Alert color="red" role="alert">
                {questionsError.message}
              </Alert>
            )}
            <Box style={{ flex: 1, minHeight: 0 }}>
              <LessonEditor
                key={openLesson?.id ?? "new"}
                lesson={openLesson}
                moduleQuestions={moduleQuestions}
                previousModuleQuestions={previousModuleQuestions}
                moduleTitle={title.ar ?? ""}
                moduleDescription={description.ar ?? ""}
                moduleContent={content.ar ?? ""}
                onCreate={handleCreateLesson}
                onUpdate={handleUpdateLesson}
                onBack={() => setLessonEditorTarget(null)}
              />
            </Box>
          </Stack>
        )}
      </Box>
    ) : (
      // `isNarrow`'s own height/flex model diverges further here than just
      // `direction` (ANA-121 PR review, caught in Storybook, not by jsdom
      // tests -- jsdom never computes real flexbox layout, so a Lessons
      // panel silently collapsed to zero height with its DOM content still
      // fully present and queryable): the wide layout's `flex: 1` on the
      // Module-fields column and `align="stretch"` on a *row* Flex both
      // depend on the row's own cross-axis (vertical) stretch to give the
      // Lessons column a real height, via the ancestor Stack's fixed
      // `EDIT_MODE_CONTENT_HEIGHT`. In a *column* Flex those same axes swap
      // -- `flex: 1` on the Module-fields Box would instead consume the
      // column's main-axis (vertical) space, starving the Lessons Box of
      // any height for its own `height: "100%"` (`LessonsPanelSkeleton`/
      // `LessonsPanel`) to resolve against. Narrow mode sidesteps this
      // entirely instead of fighting it: natural, auto-height stacking (no
      // competing `flex: 1`, no fixed-height scroll region -- the Drawer's
      // own body already scrolls the whole thing) for the Module fields,
      // and one concrete pixel height (not a percentage) for the Lessons
      // Box, so its own children have something real to fill regardless of
      // what's auto-sized above them.
      <Stack gap="lg" h={isNarrow ? "auto" : EDIT_MODE_CONTENT_HEIGHT}>
        <Flex
          gap="lg"
          direction={isNarrow ? "column" : { base: "column", md: "row" }}
          align="stretch"
          style={
            isNarrow ? undefined : { flex: 1, minHeight: 0, overflowY: "auto" }
          }
        >
          <Box style={{ flex: isNarrow ? undefined : 1, minWidth: 0 }}>
            {moduleFormFields}
          </Box>
          <Box
            h={isNarrow ? NARROW_LESSONS_PANEL_HEIGHT : undefined}
            w={isNarrow ? "100%" : { base: "100%", md: 300 }}
            style={{ flexShrink: 0 }}
          >
            {lessonsLoading ? (
              <LessonsPanelSkeleton />
            ) : lessonsError ? (
              // Non-blocking: a failed Lessons refresh never hides the
              // panel (whatever it last successfully showed, including a
              // just-written Lesson applied via `mutateLessons` above)
              // behind an error state -- it must never be presented as
              // though the write itself failed (ANA-116).
              <Stack gap="xs" style={{ height: "100%" }}>
                <Alert color="red">{lessonsError.message}</Alert>
                <Box style={{ flex: 1, minHeight: 0 }}>{lessonsPanel}</Box>
              </Stack>
            ) : (
              lessonsPanel
            )}
          </Box>
        </Flex>
        {moduleFormFooter}
      </Stack>
    );

  return (
    <>
      <Title
        size={18}
        style={{
          position: "absolute",
          zIndex: 99999,
          top: 20,
        }}
      >
        {state.mode === "create" ? (
          "Add Module"
        ) : lessonEditorTarget ? (
          <Group gap={14}>
            <Button
              variant="subtle"
              color="#fff"
              p={0}
              m={-6}
              w={32}
              h={32}
              onClick={() => setLessonEditorTarget(null)}
              disabled={isSaving}
            >
              <ArrowLeft size={14} aria-hidden="true" />
            </Button>
            {lessonEditorTarget.lessonId === null
              ? "New Lesson"
              : "Edit Lesson"}
          </Group>
        ) : (
          "Edit Module"
        )}
      </Title>

      {modeContent}
      {/* Discard confirmation (PR review) -- gates every way of dismissing
          the container (Cancel, X, Escape, backdrop/outside click, all
          funneled through `handleRequestClose` above) while any field or a
          pending Lesson reorder is unsaved. Rendered here, outside
          `modeContent`'s own three branches, so it isn't tied to whichever
          mode happens to be showing when the dismiss was attempted -- same
          copy as LessonEditor's own identical guard (lesson-editor.tsx) and
          Module Builder's (import-source-modal.tsx). */}
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
            onClose();
          }}
        />
      )}
    </>
  );
}
