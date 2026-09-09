"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Loader,
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
import { fetchJson, HttpError } from "../../fetch-json";
import { ImportSourceModal } from "../../import-source/import-source-modal";
import { deleteModule } from "../../import-source/modules-client";
import type { MockModule } from "../../mock-modules";
import { ModulesPanel } from "../../modules-panel";
import type { Book } from "@/lib/books/types";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import type { Module } from "@/lib/modules/types";
import type { Source } from "@/lib/sources/types";

function getModuleLabel(module: Module): string {
  // The panel's own `Module N` fallback (see modules-panel.tsx) covers a
  // blank label -- passing "" through when both languages are empty lets
  // that fallback do the last step instead of duplicating it here.
  return module.title.ar || module.title.en || "";
}

const BOOK_FORM_ID = "edit-book-form";

// Edit Book (ANA-65): loads through `GET /api/v1/books/{bookId}` and saves
// through `PATCH /api/v1/books/{bookId}` -- a 404 renders as a real
// not-found state rather than ever falling back to mock data. Uses SWR for
// the read (see books-table.tsx for why) so it doesn't need a `useEffect`.
export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    data: book,
    error,
    isLoading,
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

  // If the server's Module *set* has changed since the draft was built --
  // e.g. a Module was created or deleted elsewhere (Import Source's Finish/
  // Save changes, or this page's own Delete) while a reorder was pending --
  // the draft can no longer be trusted to cover every current Module, so
  // fall back to the fresh server order rather than risk submitting a
  // stale/incomplete reorder. A same-set reorder of the *same* Modules is
  // exactly what `isValidReorder` already checks (ANA-62). Runs during
  // render (React's documented "adjusting state when a prop changes"
  // pattern) rather than a `useEffect`, which this project's lint config
  // flags any state update inside as an error (see AGENTS.md).
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
  // Whether this Book already has a saved Source (ANA-71) -- fetched here,
  // not gated on the Import Modules modal being open, since which internal
  // modal flow the header button opens (saved Source workspace vs. PDF
  // import) needs to be known before the modal has ever been opened. The
  // button's own label/icon are fixed ("Import Modules", ANA-83) and don't
  // vary with this. Shares the modal's own Source-by-bookId SWR cache entry
  // (same key) so opening the modal right after doesn't re-fetch.
  //
  // `sourceData` (rather than a separate loading/error flag) is also what
  // decides whether the Import Modules button renders at all (ANA-75):
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
  // ModulesPanel, which keeps the row visible and shows the error. Clears
  // any pending reorder draft -- it necessarily referenced the now-deleted
  // Module, so it can no longer be replayed as-is (the render-time check
  // above would also catch this once `modulesData` revalidates, but
  // clearing it immediately avoids a stale drag order flashing first).
  async function handleDeleteModule(module: MockModule) {
    if (!book) {
      return;
    }

    await deleteModule(book.id, module.id);
    await mutateModules();
    setModuleOrderDraft(null);
  }

  // Updates the local Module order draft (ANA-79) -- a plain client-side
  // state change, no network request. Validated as a same-set reorder of
  // whatever is *currently displayed* (the draft if one exists, otherwise
  // the server order) so `ModulesPanel`'s Add action -- which funnels
  // through this same prop and is still out of scope for this Book-level
  // panel (ANA-70) -- can't slip its extra, never-persisted blank entry
  // through as a "reorder".
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

      // Only relevant if a future change keeps the user on this page after
      // a successful save instead of navigating away -- revalidates so the
      // Modules panel reflects the now-persisted order rather than the
      // (no-longer-authoritative) local draft.
      if (moduleOrderDraft) {
        await mutateModules();
      }

      router.push("/admin/books");
    } catch (err) {
      // The reordered draft (if any) is deliberately left in place here --
      // a failed save must not discard the user's chosen order, only
      // report the failure so they can retry.
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
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
              Import Modules
            </Button>
          )}
          <Button
            type="submit"
            form={BOOK_FORM_ID}
            disabled={!book}
            loading={isSubmitting}
          >
            Save changes
          </Button>
        </Group>
      </Group>
      <Divider opacity={0.25} mx={-27} />

      {submitError && <Alert color="red">{submitError}</Alert>}

      {isLoading && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading book…
          </Text>
        </Group>
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
            />
          </Box>
          <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
            {modulesLoading ? (
              <Group gap="sm">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Loading modules…
                </Text>
              </Group>
            ) : (
              // Reorder is a local draft only (ANA-79): `onModulesChange`
              // just updates `moduleOrderDraft`, with no network request --
              // Save changes (the Book form's own submit, above) is what
              // persists the final order, bundled into that same PATCH.
              // Add still isn't persisted from this panel (ANA-70 scope
              // boundary -- see modules-panel.tsx); handleReorderModules'
              // same-set validation leaves it exactly as inert as before.
              // Delete is real and immediate (ANA-77, unchanged):
              // `onDeleteModule` persists it through the Module DELETE API
              // and revalidates this page's own Modules SWR data on
              // success.
              <ModulesPanel
                modules={modules}
                onModulesChange={handleReorderModules}
                onDeleteModule={handleDeleteModule}
              />
            )}
          </Box>
        </Flex>
      )}

      {book && (
        <ImportSourceModal
          opened={importSourceOpened}
          onClose={() => setImportSourceOpened(false)}
          bookId={book.id}
          onModulesCreated={() => mutateModules()}
        />
      )}
    </Stack>
  );
}
