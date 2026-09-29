"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  getDefaultZIndex,
  Group,
  Loader,
  Stack,
} from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFooter, DrawerShell } from "@/components/ui/drawer-shell";
import { FormField } from "@/components/ui/form-field";
import { SaveButton } from "@/components/ui/save-button";
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
  toFieldValue,
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
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";
import type { ModuleQuestionGroup } from "./question-fields";
import { saveLessonQuestions } from "./questions-client";
import { Plus } from "lucide-react";

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

// The nested Lessons drawer's own width (ANA-123's placeholder, ANA-124's
// real content, 500px per ANA-125) -- narrower than the Module drawer's own
// `DRAWER_WIDTH` (edit-module-drawer.tsx), which this body has no need to
// know about otherwise. Moved here from edit-module-drawer.tsx now that this
// body renders the nested `DrawerShell` itself (ANA-124) -- see this file's
// own Lessons-drawer JSX below.
const LESSONS_DRAWER_WIDTH = "min(500px, 100vw)";

// The Lesson editor drawer's own width (ANA-125) -- stacked above, and
// narrower than, the Lessons drawer it opens from, the same "each nested
// level narrower than its parent" convention `LESSONS_DRAWER_WIDTH` already
// follows relative to the Module drawer's own width.
const LESSON_EDITOR_DRAWER_WIDTH = "min(460px, 100vw)";

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
 * Rendered by the Edit Module drawer (`edit-module-drawer.tsx`, ANA-121),
 * which constructs both `"create"` (Add Module, ANA-129) and `"edit"`
 * values -- kept as its own named union (rather than inlined into
 * `ModuleEditorBodyProps`) so this body's own mode-branching logic reads
 * against a single named type. */
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
   * backend; this container never closes itself on save (ANA-129 PR
   * review), so the caller is expected to switch its own `state` from
   * `"create"` to `"edit"` for the newly created Module's id once this
   * resolves (see `edit-module-drawer.tsx`'s `onCreate` doc), which gives
   * this component a new `key` at the container level and remounts it
   * fresh in edit mode. Rejecting keeps this instance open as-is and shows
   * the error. Optional -- a caller/test that only ever opens this body in
   * edit mode has no use for it. */
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
  /** Whether the nested Lessons drawer (ANA-123 placeholder, ANA-124 real
   * content) is currently open -- owned by `EditModuleDrawer` (a plain
   * navigation flag, not editor state) and threaded through so this body
   * can render that drawer's real content, which needs its own Lessons
   * data/handlers already loaded here. */
  lessonsDrawerOpened?: boolean;
  /** Hides the nested Lessons drawer -- wired directly to its own dismiss
   * (Back, Escape, outside click), with no dirty/discard gate of its own
   * (ANA-126): reordering belongs to the Module object itself, so a pending
   * reorder is neither lost nor asked about here, only when the Module
   * drawer itself is later dismissed or saved (see `isDirty`/
   * `handlePrimaryAction` below). New Lesson/Edit no longer calls this
   * (ANA-125): they open their own nested Lesson editor drawer stacked above
   * the Lessons drawer instead, which stays open underneath it. */
  onLessonsDrawerClose?: () => void;
}

export function ModuleEditorBody({
  state,
  book,
  onClose,
  onCreate,
  onSave,
  requestCloseRef,
  lessonsDrawerOpened = false,
  onLessonsDrawerClose = () => {},
}: ModuleEditorBodyProps) {
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

  // Whether this draft (any Module field, plus a pending Lesson reorder) has
  // diverged from what it was seeded with -- mirrors LessonEditor's own
  // `isDirty` (lesson-editor.tsx). Drives `handleRequestClose` below: a
  // reorder that's never been saved is exactly as much unsaved work as an
  // edited Title (PR review), so it gates dismissing the whole container the
  // same way.
  //
  // `lessonOrderDraft` counts here (ANA-126): reordering belongs to the
  // Module object itself -- the nested Lessons drawer is purely a display/
  // navigation surface for it, with no save/discard of its own (see this
  // file's own Lessons drawer JSX below), so the only place a pending
  // reorder is ever actually persisted or discarded is this Module drawer's
  // own Save changes/Cancel.
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
  // makes no request of its own -- LessonEditor itself decides create vs.
  // update purely from whether this id is present, so no separate temporary
  // Lesson object is tracked here. `{ lessonId: "..." }` opens an existing,
  // real Lesson. Edit Module shows either the Module editor/Lessons list or
  // the open Lesson's editor, never both (the three-column layout from
  // ANA-111/ANA-114 is removed).
  //
  // The nested Lesson editor drawer (ANA-125 PR review) leaves this set
  // (never nulls it on close) and tracks open/closed separately via
  // `lessonEditorDrawerOpened` below -- the same "data vs. plain navigation
  // flag" split `lessonsDrawerOpened` already uses for the Lessons drawer
  // one level up. Nulling this on close would clear the very data
  // (`openLesson`, this drawer's own title) its `DrawerShell` needs to keep
  // rendering while it slides shut -- the same "content stays mounted, only
  // the DrawerShell's own `opened` toggles" contract `LessonsDrawerList`
  // already gets for free below (it never conditions its own rendering on
  // `lessonsDrawerOpened` at all) -- clearing it immediately was what was
  // missing the animation (PR review): the drawer's body swapped to empty at
  // the very first frame of the close, instead of letting the just-edited
  // Lesson's own fields slide away with it.
  const [lessonEditorTarget, setLessonEditorTarget] = useState<{
    lessonId: string | null;
  } | null>(null);
  const [lessonEditorDrawerOpened, setLessonEditorDrawerOpened] =
    useState(false);
  // Same Modal/Drawer-dismiss bridge as this body's own `requestCloseRef`
  // prop (ANA-126) -- points at `LessonEditor`'s own unsaved-changes guard
  // (`handleRequestClose`, lesson-editor.tsx), set via that component's
  // identical ref-assignment effect. Every way the nested Lesson editor
  // drawer can be dismissed (Back, Escape, outside click) funnels through
  // this instead of `handleLessonEditorClose` directly below, so a dirty
  // Lesson draft is never discarded silently. Initialized to
  // `handleLessonEditorClose` itself so a dismissal that somehow fires
  // before `LessonEditor` has mounted (its own effect hasn't run yet) still
  // closes the drawer rather than doing nothing.
  const lessonEditorRequestCloseRef = useRef(handleLessonEditorClose);
  // Forces a fresh `LessonEditor` mount (its own `key` below) on every open,
  // even a repeat of the exact same target (e.g. New Lesson, cancelled, New
  // Lesson again) -- since closing no longer nulls `lessonEditorTarget`,
  // `openLesson`/`lessonId` alone would otherwise stay identical across two
  // separate open sessions and React would reuse the same instance, silently
  // resurrecting whatever draft was left in it rather than starting fresh.
  // Bumped only by `handleNewLessonFromDrawer`/`handleEditLessonFromDrawer`
  // (the drawer's own open actions).
  const [lessonEditorOpenSeq, setLessonEditorOpenSeq] = useState(0);

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
    // Switches Lesson mode into editing this now-real Lesson in place
    // (ANA-129 PR review: saving must never change the screen) -- Save
    // never closes Lesson mode any more (see `LessonEditor`'s own
    // `handleSave`), so without this the editor would be left showing a
    // "New Lesson" draft with no way to tell it had actually saved. The
    // Lessons cache already has `created` (just above), so `openLesson`
    // resolves to it once this re-renders, giving the nested Lesson editor
    // drawer's own `lessonEditorInner` a new `key` -- a clean remount
    // seeded from the real, persisted Lesson rather than a blank New Lesson
    // draft.
    setLessonEditorTarget({ lessonId: created.id });
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
  // DELETE API (ANA-116) -- rejecting propagates to LessonsDrawerList,
  // which keeps the row visible and shows the error (see
  // lessons-drawer-list.tsx). Drops only the deleted Lesson's id from a
  // pending reorder draft, the same targeted-update the Modules panel's own
  // `handleDeleteModule` uses for `Book.modules` (`[id]/edit/page.tsx`).
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
  // inline underneath" behavior) -- see this file's own Lesson editor
  // drawer JSX below. The Lessons drawer is never closed here: it stays
  // mounted/open underneath, exactly as `EditModuleDrawer`'s own Module
  // drawer already stays open underneath it. `lessonOrderDraft` isn't reset
  // either way, so a pending reorder is still there once the Lesson editor
  // drawer is closed.
  function handleNewLessonFromDrawer() {
    setLessonEditorTarget({ lessonId: null });
    setLessonEditorDrawerOpened(true);
    setLessonEditorOpenSeq((seq) => seq + 1);
  }

  function handleEditLessonFromDrawer(lesson: Lesson) {
    setLessonEditorTarget({ lessonId: lesson.id });
    setLessonEditorDrawerOpened(true);
    setLessonEditorOpenSeq((seq) => seq + 1);
  }

  // Closes Lesson mode -- the shared `onBack`/`onClose` handler used by
  // `lessonEditorInner`'s own `<LessonEditor onBack>` and the Lesson editor
  // drawer's own `onClose` below. Only flips `lessonEditorDrawerOpened` off,
  // leaving `lessonEditorTarget` (and so `lessonEditorInner`) intact (see
  // that state's own doc above) so the drawer's own closing transition has
  // real content to slide away.
  function handleLessonEditorClose() {
    setLessonEditorDrawerOpened(false);
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
        // Stays open (ANA-129 PR review: saving must never change the
        // screen) -- the caller switches this same container into edit
        // mode for the newly created Module in place, by re-rendering with
        // an `"edit"` `state` once its own `onCreate` resolves (see
        // `EditModuleDrawerProps.onCreate`'s doc, edit-module-drawer.tsx).
        // That new `state.id` gives `ModuleEditorBody` a new `key` at the
        // container level, so this component itself simply gets remounted
        // fresh in edit mode -- nothing further to do here.
        await onCreate?.(fields);
      } else {
        await onSave(state.id, fields, lessonOrderDraft);

        // PR review: promote the just-persisted Lesson order into the
        // Lessons SWR cache immediately -- otherwise reopening the same
        // Module lets `useSWR` synchronously render the still-stale
        // pre-save cached order before its background revalidation returns
        // the newly persisted one (a visible flash). `lessons` is already
        // this exact order (the local reorder draft layered onto the
        // server list) whenever a reorder was actually pending; still
        // revalidates in the background for eventual correctness against
        // any concurrent server-side change.
        if (lessonOrderDraft) {
          void mutateLessons({ data: lessons }, { revalidate: true });
        }

        // Clears the pending-reorder draft now that it's persisted (ANA-129
        // PR review) -- `isDirty` includes `lessonOrderDraft !== null`, and
        // this container no longer closes/unmounts itself on save, so a
        // draft left set here would otherwise keep Save changes reading as
        // dirty forever after a successful save. `title`/`description`/etc.
        // need no equivalent reset: `initialFields` is read fresh from
        // `state.fields` every render (not frozen), so once the caller's
        // own Modules SWR cache revalidates with the saved values (see
        // `handleSaveModule`, `[id]/edit/page.tsx`), `initialFields` itself
        // catches up to match this draft and `isDirty` clears on its own.
        setLessonOrderDraft(null);
      }

      // No `onClose()` here (ANA-129 PR review) -- saving must never change
      // the screen: an edit stays open on this same Module, showing Save
      // changes reflect back to clean once the caller's own revalidation
      // lands (see above); a create stays open too, switching into edit
      // mode in place as described above. Cancel/the drawer's own dismiss
      // controls are still the only way to actually leave.
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
          Material (see suggest-module-title.ts's base prompt). Context sent
          to the server is always this Module's Arabic value (ANA-99); AI
          Assistance's *result* is both languages (ANA-135), written under
          the same rules in each. */}
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
        onAiAssist={async ({ values, instructions, context }) =>
          toFieldValue(
            await suggestModuleTitle({
              bookId: book.id,
              text: values.ar ?? "",
              additionalInstructions: instructions,
              ...context,
            }),
          )
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
        onAiAssist={async ({ values, instructions, context }) =>
          toFieldValue(
            await suggestModuleDescription({
              bookId: book.id,
              text: values.ar ?? "",
              additionalInstructions: instructions,
              ...context,
            }),
          )
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
        onAiAssist={async ({
          text,
          values,
          instructions,
          isSelection,
          context,
        }) => {
          const result = await assistLearningMaterial({
            bookId: book.id,
            text: isSelection ? text : (values.ar ?? ""),
            additionalInstructions: instructions,
            fullMaterial: isSelection ? (content.ar ?? "") : undefined,
            bilingual: !isSelection,
            ...context,
          });

          // A selection is an excerpt of the active tab's text, so it
          // replaces just that range; a whole-field run fills both
          // languages (ANA-135).
          return isSelection ? result.ar : toFieldValue(result);
        }}
        getAIAssistanceContext={() => ({
          moduleTitle: title.ar ?? "",
          moduleDescription: description.ar ?? "",
        })}
        onBusyChange={setContentBusy}
      />

      {/* Color, then Published, each its own full row (ANA-123) -- the
          drawer's 560px width has no room for a side-by-side row. Published
          reflects and edits this Module's own persisted `isPublished`,
          included in both create and update Module persistence
          (module-fields.ts). */}
      <ColorField value={color} onChange={setColor} />
      <ToggleCard
        label="Published"
        checked={isPublished}
        onChange={setIsPublished}
      />

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
      <SaveButton
        dirty={isDirty}
        onClick={() => void handlePrimaryAction()}
        loading={isSaving}
        disabled={aiBusy}
      >
        {state.mode === "create" ? "Save Module" : "Save changes"}
      </SaveButton>
    </Group>
  );

  // Lesson mode's own content -- the questions-loading/unavailable gates
  // plus the real `LessonEditor` (ANA-115/ANA-116), rendered by the nested
  // Lesson editor drawer JSX further down. `lessonEditorTarget &&` narrows
  // it to `null` whenever no Lesson editor has ever been opened this
  // session -- closing no longer nulls it (see `lessonEditorTarget`'s own
  // doc above), so this keeps rendering the last real target throughout
  // that drawer's own closing transition instead of blanking out, or
  // resetting to an empty New Lesson draft, at the first frame of the
  // close.
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
              // `lessonEditorOpenSeq` (PR review) forces a fresh mount on
              // every open, even a repeat of the same target -- see that
              // value's own doc above.
              key={`${openLesson?.id ?? "new"}-${lessonEditorOpenSeq}`}
              lesson={openLesson}
              moduleQuestions={moduleQuestions}
              previousModuleQuestions={previousModuleQuestions}
              moduleTitle={title.ar ?? ""}
              moduleDescription={description.ar ?? ""}
              moduleContent={content.ar ?? ""}
              onCreate={handleCreateLesson}
              onUpdate={handleUpdateLesson}
              onBack={handleLessonEditorClose}
              // See `lessonEditorRequestCloseRef`'s own doc above and
              // `LessonEditor`'s own `requestCloseRef` doc
              // (lesson-editor.tsx).
              requestCloseRef={lessonEditorRequestCloseRef}
            />
          </Box>
        </Stack>
      )}
    </>
  );

  // The Module drawer's own body always shows the Module fields regardless
  // of `lessonEditorTarget` (ANA-125) -- Lesson mode renders in its own
  // nested drawer stacked above the Lessons drawer instead of replacing
  // this content (see this file's own Lesson editor drawer JSX further
  // down). Auto-height stacking -- the Drawer's own body already scrolls
  // the whole thing. Cancel/Save changes move into the shared drawer's own
  // footer via `DrawerFooter` (ANA-122) instead of rendering inline here --
  // the drawer container itself never duplicates this dirty/save logic, it
  // only supplies the fixed footer region `DrawerFooter` portals into.
  const modeContent = (
    <Stack gap="lg">
      {moduleFormFields}
      <DrawerFooter>{moduleFormFooter}</DrawerFooter>
    </Stack>
  );

  return (
    <>
      {modeContent}
      {/* Discard confirmation (PR review) -- gates every way of dismissing
          the container (Cancel, X, Escape, backdrop/outside click, all
          funneled through `handleRequestClose` above) while any field or a
          pending Lesson reorder is unsaved. Rendered here, outside
          `modeContent`, so it isn't tied to whichever mode happens to be
          showing when the dismiss was attempted -- same copy as
          LessonEditor's own identical guard (lesson-editor.tsx) and Module
          Builder's (import-source-modal.tsx).
          `zIndex` (ANA-123 PR review) pins this above Mantine's own "popover"
          elevation tier -- the drawer container's own `DrawerShell` gets a
          *stacked* z-index (`stackId="module"`, edit-module-drawer.tsx),
          which sits above Mantine's default modal tier this dialog would
          otherwise use, burying it underneath the drawer's own overlay
          instead of on top of it. */}
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
          despite being mounted several components deeper than it. */}
      <DrawerShell
        opened={lessonsDrawerOpened}
        title="Lessons"
        onClose={onLessonsDrawerClose}
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
      >
        {lessonsError && (
          // Non-blocking -- a failed background refresh never hides
          // whatever this list last successfully showed.
          <Alert color="red" mb="sm">
            {lessonsError.message}
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

      {/* The Lesson editor drawer (ANA-125): New Lesson/Edit, triggered from
          the Lessons drawer's own header action/card actions above, open the
          existing Lesson configuration UI (`LessonEditor`, unchanged) in a
          third `DrawerShell` stacked above the Lessons drawer, rather than
          replacing that drawer's own content -- see
          `handleNewLessonFromDrawer`/`handleEditLessonFromDrawer`'s doc for
          what changed. Renders `lessonEditorInner` directly -- no
          fixed-height cap -- so it behaves the same way the Module drawer's
          own content does: no artificial height limit, sized by whatever
          `DrawerShell`'s own `.body` region actually has available,
          scrolling that same way if the Lesson form's content is taller
          than it.
          `opened` is `lessonEditorDrawerOpened`, not `lessonEditorTarget !==
          null` (PR review) -- see that state's own doc above for why closing
          leaves `lessonEditorTarget` (and so `lessonEditorInner`/this title)
          set instead of nulling it, so the drawer has real content to
          animate shut instead of going blank on the first frame. Stacked
          (`stackId`) the same way the Lessons drawer stacks above the Module
          drawer, so it inherits the same "only the topmost drawer responds
          to Escape/outside click" behavior, and closing it (Back, Escape,
          outside click) reveals the still-open Lessons drawer underneath --
          the Lessons drawer is never touched here.
          `onClose` is `() => lessonEditorRequestCloseRef.current()`, not
          `handleLessonEditorClose` directly (ANA-126) -- every way this
          drawer can be dismissed (its own Back button, Escape, outside
          click) is funneled through Mantine's single `onClose` prop (see
          `DrawerShell`'s own doc, drawer-shell.tsx: its Back button falls
          back to `onClose` when no separate `onBack` is given, as here), so
          routing that one prop through `LessonEditor`'s own dirty check is
          enough to guard all three -- preserving its existing "Discard
          unsaved changes?" confirmation instead of bypassing it the way
          calling `handleLessonEditorClose` here directly used to (the bug
          this fixes). Confirming discard (or dismissing while clean) still
          resolves to `handleLessonEditorClose` itself, via `LessonEditor`'s
          own `onBack` call -- closing only this drawer and revealing the
          still-open Lessons drawer underneath, never anything more. */}
      <DrawerShell
        opened={lessonEditorDrawerOpened}
        title={
          lessonEditorTarget?.lessonId === null ? "New Lesson" : "Edit Lesson"
        }
        onClose={() => lessonEditorRequestCloseRef.current()}
        size={LESSON_EDITOR_DRAWER_WIDTH}
        stackId="lesson-editor"
        // No `footer` prop here (PR review) -- `LessonEditor` itself
        // portals its own Save changes into this drawer's footer region via
        // `DrawerFooter` (see `lessonEditorInner`'s own `<LessonEditor>`
        // call above), the same "the deeply-nested consumer that owns the
        // action's state portals it in" pattern `modeContent` already uses
        // for Module mode's own Save changes in this same drawer.
      >
        {lessonEditorInner}
      </DrawerShell>
    </>
  );
}
