"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { FileText } from "lucide-react";

import {
  BookForm,
  toBookFormValues,
  toBookWritableFields,
  type BookFormValues,
} from "../../book-form";
import { EditModuleDrawer } from "../../edit-module-drawer";
import { fetchJson, HttpError } from "../../fetch-json";
import { ImportSourceModal } from "../../import-source/import-source-modal";
import {
  createMaterial,
  updateMaterial,
} from "../../import-source/materials-client";
import {
  createModule,
  deleteModule,
  updateModule,
} from "../../import-source/modules-client";
import type { MockModule } from "../../mock-modules";
import {
  createEmptyModuleFieldsValues,
  toMaterialContent,
  toModuleCreateFields,
  toModuleFieldsValues,
  toModulePatchFields,
  type ModuleFieldsValues,
} from "../../module-fields";
import { ModulesPanel } from "../../modules-panel";
import { SaveButton } from "@/components/ui/save-button";
import type { Book } from "@/lib/books/types";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import { preferredTranslatableStringValue } from "@/lib/learning-content/translatable-string";
import type { Material } from "@/lib/materials/types";
import type { Module } from "@/lib/modules/types";
import type { Source } from "@/lib/sources/types";

function getModuleLabel(module: Module): string {
  // The panel's own `Module N` fallback (see modules-panel.tsx) covers a
  // blank label -- passing "" through when both languages are empty lets
  // that fallback do the last step instead of duplicating it here.
  return preferredTranslatableStringValue(module.title);
}

/** Which Module editing container (ANA-94) is open, if any -- `"create"`
 * needs nothing else and opens the Edit Module modal (Add Module); `"edit"`
 * only carries the target Module's id, since its current fields are read
 * fresh from `modulesData` at render time (see `getModuleFields` below)
 * rather than snapshotted into this state, and opens the Edit Module drawer
 * instead of that same modal (ANA-121) -- see the two containers rendered
 * near the bottom of this component. */
type ModuleModalTarget = { mode: "create" } | { mode: "edit"; id: string };

const BOOK_FORM_ID = "edit-book-form";

const MODULES_SKELETON_ROW_COUNT = 4;

// Approximates ModulesPanel/ItemList's own card chrome -- header, a few
// rows, an Add footer (see modules-panel.tsx/item-list.tsx) -- closely
// enough that swapping in the real panel doesn't shift the page's layout
// (ANA-104). Rendered both while the Book itself is still loading (there is
// no owning Book id yet to key the Modules/Materials SWR hooks off of) and,
// once it has, while those hooks are loading in turn -- see both call sites
// below. `aria-hidden` keeps its decorative bars out of the accessibility
// tree; the wrapping `status` region's `aria-label` is what's announced.
function ModulesPanelSkeleton() {
  return (
    <Box
      role="status"
      aria-label="Loading modules"
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
        {Array.from({ length: MODULES_SKELETON_ROW_COUNT }).map((_, index) => (
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

// Approximates BookForm's own field layout (Title, Description, Long
// description, In-app image ID + Color, Locked + Published -- see
// book-form.tsx) so the page's left column keeps a stable height while the
// Book itself is still loading (ANA-104); BookForm only ever renders once
// `book` has resolved. Same `aria-hidden`/`status` pattern as
// `ModulesPanelSkeleton` above.
function BookFormSkeleton() {
  return (
    <Stack gap="lg" role="status" aria-label="Loading book">
      <Stack mt={15} gap={6} aria-hidden="true">
        <Skeleton height={18} width={40} radius={5} />
        <Skeleton height={36} />
      </Stack>
      <Stack mt={14} gap={6} aria-hidden="true">
        <Skeleton height={18} width={80} radius={5} />
        <Skeleton height={36} />
      </Stack>
      <Stack mt={15} gap={6} aria-hidden="true">
        <Skeleton height={18} width={120} radius={5} />
        <Skeleton height={180} />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" aria-hidden="true">
        <Skeleton height={62} />
        <Skeleton height={62} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" aria-hidden="true">
        <Skeleton height={55} radius="md" />
        <Skeleton height={55} radius="md" />
      </SimpleGrid>
    </Stack>
  );
}

// Edit Book (ANA-65): loads through `GET /api/v1/books/{bookId}` and saves
// through `PATCH /api/v1/books/{bookId}` -- a 404 renders as a real
// not-found state rather than ever falling back to mock data. Uses SWR for
// the read (see books-table.tsx for why) so it doesn't need a `useEffect`.
export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: book,
    error,
    isLoading,
    mutate: mutateBook,
  } = useSWR(
    `/api/v1/books/${id}`,
    (url) => fetchJson<{ data: Book }>(url).then((response) => response.data),
    { shouldRetryOnError: false },
  );
  // Real Modules for the persisted Book, in Book.modules order (ANA-70) --
  // conditional on `book` so this never fires before the Book itself has
  // loaded (a bookId-less key tells SWR to skip the fetch). Add Book's own
  // pre-save/local Modules behavior is untouched -- that page never reaches
  // this one, since it has no persisted `book` to key off of.
  const {
    data: modulesData,
    isLoading: modulesLoading,
    mutate: mutateModules,
  } = useSWR(book ? `/api/v1/books/${book.id}/modules` : null, (url) =>
    fetchJson<{ data: Module[] }>(url).then((response) => response.data),
  );
  // Each Module's Learning Material (ANA-94 PR review) -- the Edit Module
  // modal's Content field is this, not a field on Module itself (see
  // module-fields.ts). Book-filtered via `?bookId=`, using the exact same
  // key AND raw (unwrapped) fetcher as the Module Builder workspace's own
  // Materials fetch (import-source-modal.tsx) -- SWR dedupes/shares one
  // cache entry per key, so a different fetcher shape here would have the
  // two consumers racing to write mismatched cached data under the same
  // key (PR review debugging: this modal reads `workspaceMaterialsData
  // .data`, so this hook must produce that same `{ data: Material[] }`
  // shape, not unwrap it).
  const {
    data: materialsData,
    error: materialsError,
    isLoading: materialsLoading,
    mutate: mutateMaterials,
  } = useSWR<{ data: Material[] }>(
    book ? `/api/v1/materials?bookId=${encodeURIComponent(book.id)}` : null,
    fetchJson,
  );
  const serverModules: MockModule[] = (modulesData ?? []).map((module) => ({
    id: module.id,
    title: getModuleLabel(module),
  }));
  // A pending drag-and-drop reorder, not yet persisted (ANA-79) -- `null`
  // means "show the server order as-is". Module sorting on this page is a
  // local draft: dropping a Module never makes a network request by
  // itself, only Save changes (the Book form's own submit) persists it,
  // bundled into that same `PATCH /api/v1/books/{bookId}` request as the
  // rest of the form's fields (the endpoint already accepts `modules`
  // alongside other writable fields -- see lib/books/validation.ts).
  const [moduleOrderDraft, setModuleOrderDraft] = useState<MockModule[] | null>(
    null,
  );
  const [modalTarget, setModalTarget] = useState<ModuleModalTarget | null>(
    null,
  );
  // Reported by BookForm's own `onDirtyChange` (ANA-129) -- whether its
  // fields have diverged from the Book they were seeded with. Combined
  // with `moduleOrderDraft` below (a pending Modules reorder is exactly as
  // much unsaved work, and Save changes persists both in the same request,
  // see `handleSubmit`) into the one `isDirty` this page's Save changes
  // button reflects.
  const [isBookFormDirty, setIsBookFormDirty] = useState(false);
  const isDirty = isBookFormDirty || moduleOrderDraft !== null;
  // Retry-safety for Create Module's two-step Module-then-Material create
  // (ANA-94 PR review): once the Module itself has been created, its real
  // id is remembered here so a retried Save Module (after a Material-
  // creation failure) only retries `createMaterial`, never creates a
  // second Module. Reset whenever a fresh create session actually starts
  // (see `onAddModule` below) -- otherwise a later, unrelated Add Module
  // click could attach its Material to a stale id left over from an
  // earlier, abandoned attempt.
  const [pendingCreatedModuleId, setPendingCreatedModuleId] = useState<
    string | null
  >(null);

  // If the server's Module *set* has changed since the draft was built --
  // e.g. a Module was created or deleted elsewhere (Import Source's Finish/
  // Save changes, this page's own Delete, or Add Module's own backend
  // create, ANA-94) while a reorder was pending -- the draft can no longer
  // be trusted to cover every current Module, so fall back to the fresh
  // server order rather than risk submitting a stale/incomplete reorder. A
  // same-set reorder of the *same* Modules is exactly what `isValidReorder`
  // already checks (ANA-62). Runs during render (React's documented
  // "adjusting state when a prop changes" pattern) rather than a
  // `useEffect`, which this project's lint config flags any state update
  // inside as an error (see AGENTS.md).
  if (
    modulesData &&
    moduleOrderDraft &&
    !isValidReorder(
      moduleOrderDraft.map((module) => module.id),
      modulesData.map((module) => module.id),
    )
  ) {
    setModuleOrderDraft(null);
  }

  const modules: MockModule[] = moduleOrderDraft ?? serverModules;

  // Resolves an existing Module's current field values for the Edit Module
  // modal (ANA-94) -- always read fresh from `modulesData`/`materialsData`,
  // the one source of truth now that Save changes persists through the
  // backend instead of a local-only draft (ANA-91). Content is seeded from
  // this Module's existing Learning Material, if it has one (ANA-94 PR
  // review) -- previously this always started blank, discarding content
  // Module Builder had already saved for it.
  function getModuleFields(id: string): ModuleFieldsValues {
    const serverModule = modulesData?.find((module) => module.id === id);
    if (!serverModule) {
      return createEmptyModuleFieldsValues();
    }

    const material = materialsData?.data.find(
      (candidate) => candidate.moduleId === id,
    );
    return toModuleFieldsValues(serverModule, material?.content);
  }
  // Whether this Book already has a saved Source (ANA-71) -- fetched here,
  // not gated on the Module Builder modal being open, since which internal
  // modal flow the header button opens (saved Source workspace vs. PDF
  // import) needs to be known before the modal has ever been opened. The
  // button's own label/icon are fixed ("Module Builder", ANA-83) and don't
  // vary with this. Shares the modal's own Source-by-bookId SWR cache entry
  // (same key) so opening the modal right after doesn't re-fetch.
  //
  // `sourceData` (rather than a separate loading/error flag) is also what
  // decides whether the Module Builder button renders at all (ANA-75):
  // while the lookup is pending or has failed, SWR leaves `data` at
  // `undefined` (there's no earlier successful fetch to fall back to), so
  // gating the button on `sourceData` being present keeps it hidden for
  // both cases instead of guessing which modal flow to route into before
  // the real answer arrives.
  const { data: sourceData } = useSWR<{ data: Source[] }>(
    book ? `/api/v1/sources?bookId=${encodeURIComponent(book.id)}` : null,
    fetchJson,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSourceOpened, setImportSourceOpened] = useState(false);

  const notFound = error instanceof HttpError && error.status === 404;

  // Deletes a real, persisted Module via the Module DELETE API (ANA-77) --
  // the service layer cascades this to that Module's Learning Material.
  // `book` is always set here: ModulesPanel only renders once it has loaded
  // (see the render below). Revalidates the Modules SWR data on success so
  // the row disappears without a page reload; a rejection propagates to
  // ModulesPanel, which keeps the row visible and shows the error. If a
  // reorder draft is pending, drops only the deleted Module's id from it
  // rather than resetting the whole draft (ANA-94 PR review) -- discarding
  // it entirely would also throw away an unrelated, still-unsaved reorder
  // of the *other* Modules; the render-time staleness check above can't
  // help here since it only fires once `modulesData` has already
  // revalidated, and would otherwise show the pre-delete server order
  // flash first.
  async function handleDeleteModule(module: MockModule) {
    if (!book) {
      return;
    }

    await deleteModule(book.id, module.id);
    await mutateModules();
    setModuleOrderDraft((draft) =>
      draft ? draft.filter((candidate) => candidate.id !== module.id) : draft,
    );
  }

  // Updates the local Module order draft (ANA-79) -- a plain client-side
  // state change, no network request. Validated as a same-set reorder of
  // whatever is *currently displayed* (the draft if one exists, otherwise
  // the server order); Add no longer funnels through this prop (ANA-94 --
  // it opens the Module modal instead, see `onAddModule` below), so this is
  // exactly the original ANA-79 reorder-only behavior.
  function handleReorderModules(reordered: MockModule[]) {
    if (
      !isValidReorder(
        reordered.map((module) => module.id),
        modules.map((module) => module.id),
      )
    ) {
      return;
    }

    setModuleOrderDraft(reordered);
  }

  // Creates a new Module through the backend (ANA-94) -- the Module modal
  // (in create mode) awaits this and only closes/considers the Module
  // "added" once it resolves; a rejection leaves the modal open showing the
  // error, and nothing is added to the displayed list. The Content field
  // is this Module's Learning Material, not a Module field itself, so it's
  // always persisted separately via `createMaterial` (ANA-94 PR review) --
  // matching Module Builder's own Module+Material creation pattern
  // (import-source-modal.tsx) -- once the Module itself exists and its
  // real id is known; every new Module gets a Material this way, even one
  // whose Content was left blank.
  //
  // Retry-safe (ANA-94 PR review): if `createModule` succeeds but the
  // following `createMaterial` fails, the Module already exists in the
  // backend -- `pendingCreatedModuleId` remembers its real id so a retried
  // Save Module (the modal never closes on failure) only retries
  // `createMaterial` against that same Module, instead of calling
  // `createModule` again and orphaning the first one as a duplicate.
  // Revalidates the Modules and Materials SWR data on success so the new
  // id and its fields show up without a page reload, and drops any
  // pending reorder draft -- it necessarily predates this Module and so
  // can no longer be replayed as a valid same-set reorder (the render-time
  // check above would also catch this once `modulesData` revalidates, but
  // clearing it immediately avoids a stale order flashing first).
  async function handleCreateModule(fields: ModuleFieldsValues) {
    if (!book) {
      return;
    }

    let moduleId = pendingCreatedModuleId;

    if (moduleId === null) {
      const created = await createModule(book.id, toModuleCreateFields(fields));
      moduleId = created.id;
      setPendingCreatedModuleId(moduleId);
    }

    await createMaterial(book.id, moduleId, toMaterialContent(fields));

    setPendingCreatedModuleId(null);
    await mutateModules();
    await mutateMaterials();
    setModuleOrderDraft(null);
    // Switches the drawer into edit mode for the Module just created
    // (ANA-129 PR review: saving must never change the screen) -- the
    // drawer itself never closes on save (module-editor-body.tsx), so
    // without this the user would be left staring at the same blank
    // create draft with no way to tell it had actually saved. `getModuleFields`
    // (below) reads from `modulesData`, already revalidated above, so the
    // freshly-mounted edit-mode `ModuleEditorBody` this triggers (a new
    // `state.id` means a new `key`, see edit-module-drawer.tsx) seeds from
    // the real, just-saved fields rather than a blank flash.
    setModalTarget({ mode: "edit", id: moduleId });
  }

  // Persists an existing Module's edited fields through the backend
  // (ANA-94) -- the Module modal awaits this the same way it awaits
  // `handleCreateModule`. Content is persisted the same way: `updateMaterial`
  // when this Module already has one (the common case), `createMaterial`
  // when it doesn't yet (e.g. a Module that predates this feature) -- the
  // same existing-id branch Module Builder's own Finish step uses (PR
  // review). Revalidates the Modules and Materials SWR data on success. If
  // a reorder draft is currently pending (the id set is unaffected by an
  // edit, so the render-time staleness check above won't reset it), its
  // matching entry's display title is patched too -- otherwise the panel
  // would keep showing this Module's pre-edit title, read from the now-
  // stale draft, until that reorder is either saved or abandoned.
  //
  // `lessonsOrder` (ANA-117) is the Edit Module modal's own pending Lesson
  // reorder, if any -- bundled into this same Module PATCH as `lessons`,
  // exactly like this page's own Module reorder rides along in the Book
  // PATCH (`handleSubmit` below). `null` (no drag happened this session)
  // leaves the field out of the request entirely, so the endpoint's own
  // "omitted field is left unchanged" contract preserves whatever order is
  // already persisted.
  async function handleSaveModule(
    id: string,
    fields: ModuleFieldsValues,
    lessonsOrder: string[] | null,
  ) {
    if (!book) {
      return;
    }

    const patchFields = toModulePatchFields(fields);

    await updateModule(
      book.id,
      id,
      lessonsOrder ? { ...patchFields, lessons: lessonsOrder } : patchFields,
    );

    const existingMaterial = materialsData?.data.find(
      (material) => material.moduleId === id,
    );
    const content = toMaterialContent(fields);

    if (existingMaterial) {
      await updateMaterial(existingMaterial.id, content);
    } else {
      await createMaterial(book.id, id, content);
    }

    await mutateModules();
    await mutateMaterials();
    setModuleOrderDraft((draft) =>
      draft
        ? draft.map((module) =>
            module.id === id
              ? { ...module, title: fields.title.ar || fields.title.en || "" }
              : module,
          )
        : draft,
    );
  }

  async function handleSubmit(values: BookFormValues) {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // The reordered Module ids are only ever included when the user
      // actually dragged something in this session -- otherwise `modules`
      // stays absent from the body entirely, matching the endpoint's own
      // "omitted field is left unchanged" contract (lib/books/validation.ts)
      // and this page's existing no-drag save behavior.
      const body: Record<string, unknown> = toBookWritableFields(values);

      if (moduleOrderDraft) {
        body.modules = moduleOrderDraft.map((module) => module.id);
      }

      const response = await fetch(`/api/v1/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      // Revalidates so the Modules panel reflects the now-persisted order
      // rather than the (no-longer-authoritative) local draft, then drops
      // the draft itself -- it's persisted now, so `isDirty` (below) must
      // stop counting it (ANA-129 PR review: this page no longer navigates
      // away on save, so a leftover draft would otherwise read as dirty
      // forever after a successful save).
      if (moduleOrderDraft) {
        await mutateModules();
        setModuleOrderDraft(null);
      }

      // Revalidates the Book itself so anything else on this page reading
      // `book` reflects the just-saved values -- not what resets BookForm's
      // own dirty state, though (its own `baseline` is reset directly, see
      // `onDirtyChange`'s wiring above/book-form.tsx's `handleSubmit`,
      // since a background SWR revalidation must never silently overwrite
      // an in-progress edit).
      await mutateBook();

      // No navigation here (ANA-129 PR review: saving must never change
      // the screen) -- the admin stays on this same Edit Book page, Save
      // changes reflecting back to clean once BookForm resets its own
      // baseline (see book-form.tsx).
    } catch (err) {
      // The reordered draft (if any) is deliberately left in place here --
      // a failed save must not discard the user's chosen order, only
      // report the failure so they can retry.
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      // Rethrown so BookForm's own awaited `onSubmit` (book-form.tsx) knows
      // this attempt failed and leaves its draft/dirty state untouched
      // instead of optimistically marking it saved.
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={2}>Edit Book</Title>
        <Group gap="sm">
          {book && sourceData && (
            <Button
              variant="default"
              onClick={() => setImportSourceOpened(true)}
              leftSection={<FileText size={16} aria-hidden="true" />}
            >
              Module Builder
            </Button>
          )}
          <SaveButton
            dirty={isDirty}
            type="submit"
            form={BOOK_FORM_ID}
            disabled={!book}
            loading={isSubmitting}
          >
            Save changes
          </SaveButton>
        </Group>
      </Group>
      <Divider opacity={0.25} mx={-27} />

      {submitError && <Alert color="red">{submitError}</Alert>}

      {isLoading && (
        <Flex
          gap="xl"
          direction={{ base: "column", md: "row" }}
          align="stretch"
        >
          <Box style={{ flex: 1, minWidth: 0 }}>
            <BookFormSkeleton />
          </Box>
          <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
            <ModulesPanelSkeleton />
          </Box>
        </Flex>
      )}

      {error && !notFound && <Alert color="red">{error.message}</Alert>}

      {notFound && (
        <Text c="dimmed" size="sm">
          This book could not be found.
        </Text>
      )}

      {book && (
        <Flex
          gap="xl"
          direction={{ base: "column", md: "row" }}
          align="stretch"
        >
          <Box style={{ flex: 1, minWidth: 0 }}>
            <BookForm
              id={BOOK_FORM_ID}
              initialValues={toBookFormValues(book)}
              onSubmit={handleSubmit}
              onDirtyChange={setIsBookFormDirty}
            />
          </Box>
          <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
            {modulesLoading || materialsLoading ? (
              <ModulesPanelSkeleton />
            ) : materialsError ? (
              // Blocks the whole panel rather than rendering it with
              // `materialsData` left `undefined` (ANA-94 PR review) --
              // treating a failed Materials lookup as "this Module has no
              // Material" is exactly the bug that opened Edit Module with
              // blank Content and made Save create a duplicate Material
              // instead of updating the real one. The Material service
              // doesn't enforce one Material per Module, so nothing short
              // of blocking here prevents that.
              <Alert color="red">
                Couldn&rsquo;t load this book&rsquo;s Learning Material (
                {materialsError.message}). Reload the page to try again.
              </Alert>
            ) : (
              // Reorder is a local draft only (ANA-79): `onModulesChange`
              // just updates `moduleOrderDraft`, with no network request --
              // Save changes (the Book form's own submit, above) is what
              // persists the final order, bundled into that same PATCH. Add,
              // Edit, and Delete are all real backend operations (ANA-94/
              // ANA-77): Add and Edit open this page's own top-level Module
              // modal (create/edit mode respectively), which persists
              // through `handleCreateModule`/`handleSaveModule`; Delete
              // persists immediately through the Module DELETE API via
              // `onDeleteModule`. All three revalidate this page's own
              // Modules SWR data on success.
              <ModulesPanel
                modules={modules}
                onModulesChange={handleReorderModules}
                onDeleteModule={handleDeleteModule}
                onEditModule={(module) =>
                  setModalTarget({ mode: "edit", id: module.id })
                }
                onAddModule={() => {
                  // A genuinely new create session -- forget any Module id
                  // left over from a previous, abandoned create attempt
                  // (see `pendingCreatedModuleId` above), or this one would
                  // wrongly attach its Material to that stale Module
                  // instead of creating its own.
                  setPendingCreatedModuleId(null);
                  setModalTarget({ mode: "create" });
                }}
              />
            )}
          </Box>
        </Flex>
      )}

      {book && (
        // Add Module and Edit Module both open this right-side drawer
        // (ANA-129 unifies Add Module onto it too, for consistency with the
        // pencil action's existing drawer flow -- previously only Edit
        // opened the drawer, Add Module opened a separate Edit Module modal,
        // removed once this drawer became the only consumer of
        // `ModuleEditorBody`, ANA-128) -- same fields, AI actions,
        // validation, Lesson list/editor, and save/discard behavior (see
        // edit-module-drawer.tsx).
        <EditModuleDrawer
          state={
            modalTarget?.mode === "create"
              ? { mode: "create" }
              : modalTarget?.mode === "edit"
                ? {
                    mode: "edit",
                    id: modalTarget.id,
                    fields: getModuleFields(modalTarget.id),
                  }
                : null
          }
          book={book}
          onClose={() => setModalTarget(null)}
          onCreate={handleCreateModule}
          onSave={handleSaveModule}
        />
      )}

      {book && (
        <ImportSourceModal
          opened={importSourceOpened}
          onClose={() => setImportSourceOpened(false)}
          bookId={book.id}
          onModulesCreated={() => {
            mutateModules();
            // Module Builder's own Finish step creates each new Module's
            // Learning Material in the same operation -- revalidate it
            // here too, or the Edit Module modal's Content field would
            // show stale (blank) content for one of these Modules until
            // an unrelated action happened to revalidate it.
            mutateMaterials();
          }}
          // Lets the modal's saved-Source workspace seed its own initial
          // order from whatever is currently displayed here, including an
          // unsaved drag reorder (ANA-84) -- `null` (not this page's own
          // `modules`) when there's no local draft, so the modal falls back
          // to its usual persisted-order seeding unchanged.
          outerModuleOrder={
            moduleOrderDraft
              ? moduleOrderDraft.map((module) => module.id)
              : null
          }
          // The modal only calls this once its own Save changes has
          // actually persisted a new Module order -- adopts that as this
          // page's own order and clears the local draft it just
          // superseded, instead of leaving a stale draft to later
          // resurrect an older order once modulesData revalidates.
          onModuleOrderPersisted={async () => {
            await mutateModules();
            setModuleOrderDraft(null);
          }}
        />
      )}
    </Stack>
  );
}
