"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Flex,
  getDefaultZIndex,
  Group,
  Loader,
  Skeleton,
  Stack,
  Title,
} from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFooter, DrawerShell } from "@/components/ui/drawer-shell";
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
import { LessonsDrawerList } from "./lessons-drawer-list";
import { LessonsPanel } from "./lessons-panel";
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";
import type { ModuleQuestionGroup } from "./question-fields";
import { saveLessonQuestions } from "./questions-client";
import { ArrowLeft, Plus } from "lucide-react";

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

// The nested Lessons drawer's own width (ANA-123's placeholder, ANA-124's
// real content, 500px per ANA-125) -- narrower than the Module drawer's own
// `DRAWER_WIDTH` (edit-module-drawer.tsx), which this body has no need to
// know about otherwise. Moved here from edit-module-drawer.tsx now that this
// body renders the nested `DrawerShell` itself (ANA-124) -- see this file's
// own `isNarrow` Lessons-drawer JSX below.
const LESSONS_DRAWER_WIDTH = "min(500px, 100vw)";

// The Lesson editor drawer's own width (ANA-125) -- stacked above, and
// narrower than, the Lessons drawer it opens from, the same "each nested
// level narrower than its parent" convention `LESSONS_DRAWER_WIDTH` already
// follows relative to the Module drawer's own width.
const LESSON_EDITOR_DRAWER_WIDTH = "min(460px, 100vw)";

/** Fixed at the `md`+ breakpoint only (ANA-117) -- Module mode's editor +
 * Lessons list and Lesson mode's own editor render this same height
 * regardless of which is taller, so switching between them never resizes
 * the container itself (each mode's own wrapper below sets `overflowY:
 * "auto"`). Left at `auto` below `md`, where the two columns already stack
 * instead of sitting side by side -- constraining height there would fight
 * that stacked layout's own natural scroll instead of stabilizing anything.
 * Used by the wide/Modal layout's own Module mode and Lesson mode -- the
 * drawer's narrow layout uses auto-height stacking for Module mode instead
 * (ANA-123: it no longer renders the Lessons list, so there's no second
 * column to size against), and, since ANA-125, for its own nested Lesson
 * editor drawer too: that has no sibling content of its own height needs to
 * match, so it's sized by whatever `DrawerShell`'s own body has available
 * instead, same as the drawer's Module mode already is. */
const EDIT_MODE_CONTENT_HEIGHT = { base: "auto", md: 544 } as const;

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
  /** Whether the nested Lessons drawer (ANA-123 placeholder, ANA-124 real
   * content) is currently open -- owned by `EditModuleDrawer` (a plain
   * navigation flag, not editor state) and threaded through so this body
   * can render that drawer's real content, which needs its own Lessons
   * data/handlers already loaded here. Ignored (and the drawer never
   * rendered) unless `layout` is `"narrow"` -- the modal has no nested
   * Lessons drawer of its own. */
  lessonsDrawerOpened?: boolean;
  /** Hides the nested Lessons drawer -- called once its own dismiss is
   * either confirmed (a discard) or was never gated (a clean close). New
   * Lesson/Edit no longer calls this (ANA-125): they open their own nested
   * Lesson editor drawer stacked above the Lessons drawer instead, which
   * stays open underneath it. */
  onLessonsDrawerClose?: () => void;
}

export function ModuleEditorBody({
  state,
  book,
  onClose,
  onCreate,
  onSave,
  requestCloseRef,
  layout = "wide",
  lessonsDrawerOpened = false,
  onLessonsDrawerClose = () => {},
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

  // The nested Lessons drawer's own Save changes state (ANA-124) --
  // entirely separate from the Module drawer's own `isSaving`/`saveError`
  // above, since the two Save actions are independent requests a user can
  // never trigger at the same time (the Lessons drawer's own overlay blocks
  // interaction with the Module drawer underneath while it's open).
  const [lessonsSaving, setLessonsSaving] = useState(false);
  const [lessonsSaveError, setLessonsSaveError] = useState<string | null>(null);
  // Gates dismissing the Lessons drawer (Back, Cancel, Escape, backdrop/
  // outside click) behind the same "Discard unsaved changes?" confirmation
  // as the Module drawer's own, whenever `lessonsDrawerIsDirty` is true --
  // see `handleLessonsDrawerRequestClose` below.
  const [confirmingLessonsDiscard, setConfirmingLessonsDiscard] =
    useState(false);

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

  // Whether this draft (any Module field, plus -- wide/Modal layout only --
  // a pending Lesson reorder) has diverged from what it was seeded with --
  // mirrors LessonEditor's own `isDirty` (lesson-editor.tsx). Drives
  // `handleRequestClose` below: a reorder that's never been saved is
  // exactly as much unsaved work as an edited Title (PR review), so it
  // gates dismissing the whole container the same way.
  //
  // The narrow/Drawer layout excludes `lessonOrderDraft` here (ANA-124):
  // that reorder now belongs to the nested Lessons drawer's own,
  // independent dirty state (see `lessonsDrawerIsDirty` below) -- opening/
  // closing that drawer, or reordering inside it, must never itself mark
  // this Module drawer dirty.
  const isDirty =
    !isSameTranslatedValue(title, initialFields.title) ||
    !isSameTranslatedValue(description, initialFields.description) ||
    color !== initialFields.color ||
    !isSameTranslatedValue(content, initialFields.content) ||
    isPublished !== initialFields.isPublished ||
    (!isNarrow && lessonOrderDraft !== null);

  // The nested Lessons drawer's own dirty state (ANA-124) -- whether the
  // Lesson order has changed from the initial persisted Module order, the
  // exact same `lessonOrderDraft` the wide/Modal layout folds into its own
  // `isDirty` above, just tracked independently here so opening/closing
  // this drawer never touches the Module drawer's own dirty state.
  const lessonsDrawerIsDirty = lessonOrderDraft !== null;

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

  // New Lesson/Edit, triggered from the nested Lessons drawer's own header
  // action/card actions -- exactly the existing New Lesson/Edit behavior
  // (`setLessonEditorTarget`, unchanged from ANA-115), which now opens its
  // own nested Lesson editor drawer stacked above the Lessons drawer
  // (ANA-125, replacing ANA-124's "hide the Lessons drawer, show Lesson mode
  // inline underneath" behavior) -- see this file's own `isNarrow` Lesson
  // editor drawer JSX below. The Lessons drawer is never closed here: it
  // stays mounted/open underneath, exactly as `EditModuleDrawer`'s own Module
  // drawer already stays open underneath it. `lessonOrderDraft` isn't reset
  // either way, so a pending reorder is still there once the Lesson editor
  // drawer is closed.
  function handleNewLessonFromDrawer() {
    setLessonEditorTarget({ lessonId: null });
  }

  function handleEditLessonFromDrawer(lesson: Lesson) {
    setLessonEditorTarget({ lessonId: lesson.id });
  }

  // Funnels every way of dismissing the nested Lessons drawer (Back,
  // Cancel, Escape, backdrop/outside click) through one dirty check
  // (ANA-124) -- same shape as `handleRequestClose` below, scoped to
  // `lessonsDrawerIsDirty`/`lessonsSaving` instead of this body's own
  // `isDirty`/`isSaving`.
  function handleLessonsDrawerRequestClose() {
    if (lessonsSaving) {
      return;
    }

    if (lessonsDrawerIsDirty) {
      setConfirmingLessonsDiscard(true);
      return;
    }

    onLessonsDrawerClose();
  }

  // Discards the pending Lesson reorder and hides the Lessons drawer --
  // only ever called once the discard confirmation above is actually
  // confirmed.
  function handleDiscardLessonsOrder() {
    setConfirmingLessonsDiscard(false);
    setLessonOrderDraft(null);
    onLessonsDrawerClose();
  }

  // Persists the Lessons drawer's own pending reorder through the existing
  // Module save/update path (ANA-124) -- the exact same `onSave(id, fields,
  // lessonsOrder)` call `handlePrimaryAction` below makes for the Module
  // drawer's own Save changes, never a separate Lesson-order persistence
  // request/endpoint. Sends this body's current field values alongside the
  // order, same as that existing call already does (a single Module PATCH
  // always carries both together) -- this Save action is scoped to the
  // Lessons drawer itself, so it only ever hides that drawer afterward,
  // revealing the still-open Module drawer underneath, rather than closing
  // the whole editor the way `handlePrimaryAction` does.
  async function handleSaveLessonsOrder() {
    if (state.mode !== "edit") {
      return;
    }

    setLessonsSaveError(null);
    setLessonsSaving(true);

    try {
      const fields: ModuleFieldsValues = {
        title,
        description,
        color,
        content,
        isPublished,
      };

      await onSave(state.id, fields, lessonOrderDraft);

      // Same "promote the just-persisted order into the SWR cache
      // immediately" reasoning as `handlePrimaryAction` below -- avoids a
      // stale-order flash if the Lessons drawer is reopened before its own
      // background revalidation returns.
      if (lessonOrderDraft) {
        void mutateLessons({ data: lessons }, { revalidate: true });
      }

      setLessonOrderDraft(null);
      onLessonsDrawerClose();
    } catch (err) {
      setLessonsSaveError(errorMessage(err));
    } finally {
      setLessonsSaving(false);
    }
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

      {/* Published + Color: a single responsive row, Published on the left
          and Color on the right (ANA-117 PR review) -- matching Book form's
          own Locked/Published row (book-form.tsx), stacking only on narrow
          screens. The drawer (ANA-123) instead stacks Color, then Published,
          each its own full row -- its 560px width has no room for the
          side-by-side row. Published reflects and edits this Module's own
          persisted `isPublished`, included in both create and update Module
          persistence (module-fields.ts). */}
      {isNarrow ? (
        <>
          <ColorField value={color} onChange={setColor} />
          <ToggleCard
            label="Published"
            checked={isPublished}
            onChange={setIsPublished}
          />
        </>
      ) : (
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
      )}

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
  // Module mode's Cancel/Save changes move into the shared drawer's own
  // footer via `DrawerFooter` when this body is mounted inside one
  // (`isNarrow`, ANA-122) instead of rendering inline here -- the drawer
  // container itself never duplicates this dirty/save logic, it only
  // supplies the fixed footer region `DrawerFooter` portals into. The modal
  // (`isNarrow` false) keeps rendering it inline, exactly as before.
  const moduleFormFooterSlot = isNarrow ? (
    <DrawerFooter>{moduleFormFooter}</DrawerFooter>
  ) : (
    moduleFormFooter
  );

  // Lesson mode's own content -- the questions-loading/unavailable gates
  // plus the real `LessonEditor` (ANA-115/ANA-116), shared between the wide/
  // Modal layout's inline Lesson mode below and the narrow/Drawer layout's
  // own nested Lesson editor drawer (ANA-125, see this file's own `isNarrow`
  // Lesson editor drawer JSX further down). `lessonEditorTarget &&` narrows
  // it to `null` whenever no Lesson editor is open, so mounting this drawer
  // ahead of time (Mantine's own exit transition) never briefly shows a
  // blank New Lesson draft.
  const lessonEditorInner = lessonEditorTarget && (
    <>
      {questionsLoading ? (
        // This Module's Questions (needed to seed an existing Lesson's
        // `questions`, see lesson-fields.ts's `toLessonFieldsValues`) load
        // alongside its Lessons and have almost always already resolved by
        // the time Edit/New Lesson is clicked -- this only ever shows on a
        // genuinely slow first load.
        <Stack align="center" justify="center" h="100%">
          <Loader />
        </Stack>
      ) : questionsUnavailable && lessonEditorTarget.lessonId !== null ? (
        // Blocking (PR review): unlike a failed *background* refresh
        // (handled below, non-blocking), a genuine first-load failure here
        // means `moduleQuestions` is `[]` with no real data behind it --
        // opening this existing Lesson's editor would hydrate `questions` as
        // empty (see `toLessonFieldsValues`), and saving any other field
        // would then PATCH `questions: []`, silently detaching every one of
        // its real Questions. New Lesson (`lessonId === null`) has nothing
        // to hydrate, so it's unaffected by this gate and still opens
        // normally below.
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
            // Non-blocking: Questions have loaded at least once here (see
            // `questionsUnavailable`'s own doc), so `moduleQuestions` still
            // reflects that last good list -- a failed background
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
    </>
  );

  const modeContent =
    state.mode === "create" || isNarrow ? (
      // The narrow/Drawer layout's Module mode content never changes for an
      // open Lesson editor (ANA-125): that now renders in its own nested
      // drawer stacked above the Lessons drawer instead of replacing this
      // content (see this file's own Lesson editor drawer JSX further
      // down), so the Module drawer's own body always shows the Module
      // fields regardless of `lessonEditorTarget`. Auto-height stacking,
      // same as create mode -- the Drawer's own body already scrolls the
      // whole thing, so there's no fixed-height scroll region to coordinate
      // with a second column the way the wide layout below still does.
      <Stack gap="lg">
        {moduleFormFields}
        {moduleFormFooterSlot}
      </Stack>
    ) : lessonEditorTarget ? (
      // The wide/Modal layout has no nested Lesson editor drawer of its own
      // -- Lesson mode still replaces the Module editor/Lessons list content
      // inline here, unchanged from ANA-115/ANA-116, still pinned to the
      // shared `EDIT_MODE_CONTENT_HEIGHT` (unlike the narrow/Drawer layout's
      // own nested Lesson editor drawer below, ANA-125 PR review) so it
      // renders the same height as Module mode's own Module-editor+Lessons-
      // list split when switching between them inside this same container.
      <Stack gap="md">
        <Box h={EDIT_MODE_CONTENT_HEIGHT} style={{ overflowY: "hidden" }}>
          {lessonEditorInner}
        </Box>
      </Stack>
    ) : (
      // The wide/Modal layout's `flex: 1` on the Module-fields column and
      // `align="stretch"` on a *row* Flex both depend on the row's own
      // cross-axis (vertical) stretch to give the Lessons column a real
      // height, via the ancestor Stack's fixed `EDIT_MODE_CONTENT_HEIGHT`
      // (ANA-121 PR review, caught in Storybook, not by jsdom tests --
      // jsdom never computes real flexbox layout, so a Lessons panel
      // silently collapsed to zero height with its DOM content still fully
      // present and queryable).
      <Stack gap="lg" h={EDIT_MODE_CONTENT_HEIGHT}>
        <Flex
          gap="lg"
          direction={{ base: "column", md: "row" }}
          align="stretch"
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          <Box style={{ flex: 1, minWidth: 0 }}>{moduleFormFields}</Box>
          <Box w={{ base: "100%", md: 300 }} style={{ flexShrink: 0 }}>
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
        {moduleFormFooterSlot}
      </Stack>
    );

  return (
    <>
      {/* Only rendered for the wide/Modal layout (ANA-122) -- the narrow/
          Drawer layout gets its "Edit Module" title from the container's
          own real header (`DrawerShell`) instead, and its Lesson-mode title
          from the nested Lesson editor drawer's own header (ANA-125), so
          this fixed-pixel-position hack (kept only for the Modal, unchanged
          from before ANA-122) would otherwise duplicate/overlap both. */}
      {!isNarrow && (
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
                aria-label="Back to Module"
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
      )}

      {modeContent}
      {/* Discard confirmation (PR review) -- gates every way of dismissing
          the container (Cancel, X, Escape, backdrop/outside click, all
          funneled through `handleRequestClose` above) while any field or a
          pending Lesson reorder is unsaved. Rendered here, outside
          `modeContent`'s own three branches, so it isn't tied to whichever
          mode happens to be showing when the dismiss was attempted -- same
          copy as LessonEditor's own identical guard (lesson-editor.tsx) and
          Module Builder's (import-source-modal.tsx).
          `zIndex` (ANA-123 PR review) pins this above Mantine's own "popover"
          elevation tier -- the drawer container's own `DrawerShell` gets a
          *stacked* z-index once `layout="narrow"` (`stackId="module"`,
          edit-module-drawer.tsx), which sits above Mantine's default modal
          tier this dialog would otherwise use, burying it underneath the
          drawer's own overlay instead of on top of it. The modal container
          never stacks, so this is a no-op there -- still safely above its
          own default-tier Modal either way. */}
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
          zIndex={getDefaultZIndex("popover")}
        />
      )}

      {/* The nested Lessons drawer's real content (ANA-124, replacing
          ANA-123's `{null}` placeholder) -- rendered here rather than by
          `EditModuleDrawer` (which still owns `lessonsDrawerOpened`/
          `onLessonsDrawerClose` as a plain navigation flag, passed down as
          props) because every Lesson data/handler it needs already lives in
          this body. `Drawer.Stack`'s own context (edit-module-drawer.tsx)
          is a React context, not a DOM-adjacency requirement, so this
          `DrawerShell` still stacks correctly above the Module drawer's own
          despite being mounted several components deeper than it. Only
          rendered for the narrow/Drawer layout -- the wide/Modal layout has
          no nested Lessons drawer of its own (see `lessonsPanel` above). */}
      {isNarrow && (
        <DrawerShell
          opened={lessonsDrawerOpened}
          title="Lessons"
          onClose={handleLessonsDrawerRequestClose}
          onBack={handleLessonsDrawerRequestClose}
          size={LESSONS_DRAWER_WIDTH}
          stackId="lessons"
          headerActions={
            <Button
              leftSection={<Plus size={16} aria-hidden="true" />}
              onClick={handleNewLessonFromDrawer}
              style={{ transition: "background-color 150ms ease" }}
            >
              New Lesson
            </Button>
          }
          footer={
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={handleLessonsDrawerRequestClose}
                disabled={lessonsSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveLessonsOrder()}
                loading={lessonsSaving}
              >
                Save changes
              </Button>
            </Group>
          }
        >
          {lessonsError && (
            // Non-blocking, same as the wide/Modal layout's identical
            // treatment above -- a failed background refresh never hides
            // whatever this list last successfully showed.
            <Alert color="red" mb="sm">
              {lessonsError.message}
            </Alert>
          )}
          {lessonsSaveError && (
            <Alert color="red" role="alert" mb="sm">
              {lessonsSaveError}
            </Alert>
          )}
          <LessonsDrawerList
            lessons={lessons}
            loading={lessonsLoading}
            onReorder={handleReorderLessons}
            onEditLesson={handleEditLessonFromDrawer}
            onDeleteLesson={handleDeleteLesson}
          />
        </DrawerShell>
      )}

      {/* Discard confirmation for the Lessons drawer's own pending reorder
          (ANA-124) -- same copy/pattern as `confirmingDiscard` above, gated
          behind `lessonsDrawerIsDirty` instead of this body's own `isDirty`.
          Needs the same `getDefaultZIndex("popover")` override: this drawer
          is itself stacked (`stackId="lessons"`), which otherwise buries the
          confirmation underneath its own overlay. */}
      {confirmingLessonsDiscard && (
        <ConfirmDialog
          opened
          title="Discard unsaved changes?"
          description="Your changes have not been saved and will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmingLessonsDiscard(false)}
          onConfirm={handleDiscardLessonsOrder}
          zIndex={getDefaultZIndex("popover")}
        />
      )}

      {/* The Lesson editor drawer (ANA-125): New Lesson/Edit, triggered from
          the Lessons drawer's own header action/card actions above, now open
          the existing Lesson configuration UI (`LessonEditor`, unchanged) in
          a third `DrawerShell` stacked above the Lessons drawer, rather than
          replacing that drawer's own content -- see `handleNewLessonFromDrawer`/
          `handleEditLessonFromDrawer`'s doc for what changed. Reuses the same
          `lessonEditorInner` the wide/Modal layout's own inline Lesson mode
          renders above, and the same `lessonEditorTarget`/`setLessonEditorTarget`
          state ANA-115 already introduced -- only the container changed here,
          never the editor itself or its save behavior (`onCreate`/`onUpdate`
          still call this body's own `handleCreateLesson`/`handleUpdateLesson`,
          the existing Lesson create/update API). Unlike the wide/Modal
          layout's own usage above, this renders `lessonEditorInner` directly
          -- no `EDIT_MODE_CONTENT_HEIGHT` cap (PR review) -- so it behaves
          the same way the Module drawer's own content does: no artificial
          height limit, sized by whatever `DrawerShell`'s own `.body` region
          actually has available, scrolling that same way if the Lesson
          form's content is taller than it. Stacked (`stackId`) the same way
          the Lessons drawer stacks above the Module drawer, so it inherits
          the same "only the topmost drawer responds to Escape/outside click"
          behavior, and closing it (Back, Escape, outside click) simply clears
          `lessonEditorTarget`, revealing the still-open Lessons drawer
          underneath -- the Lessons drawer is never touched here. Only rendered
          for the narrow/Drawer layout, same as the Lessons drawer itself. */}
      {isNarrow && (
        <DrawerShell
          opened={lessonEditorTarget !== null}
          title={
            lessonEditorTarget?.lessonId === null ? "New Lesson" : "Edit Lesson"
          }
          onClose={() => setLessonEditorTarget(null)}
          size={LESSON_EDITOR_DRAWER_WIDTH}
          stackId="lesson-editor"
        >
          {lessonEditorInner}
        </DrawerShell>
      )}
    </>
  );
}
