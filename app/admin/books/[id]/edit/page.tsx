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
import { Eye, Upload } from "lucide-react";

import {
  BookForm,
  toBookFormValues,
  toBookWritableFields,
  type BookFormValues,
} from "../../book-form";
import { fetchJson, HttpError } from "../../fetch-json";
import { ImportSourceModal } from "../../import-source/import-source-modal";
import type { MockModule } from "../../mock-modules";
import { ModulesPanel } from "../../modules-panel";
import type { Book } from "@/lib/books/types";
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
  const modules: MockModule[] = (modulesData ?? []).map((module) => ({
    id: module.id,
    title: getModuleLabel(module),
  }));
  // Whether this Book already has a saved Source (ANA-71) -- fetched here,
  // not gated on the Import Source modal being open, since the header
  // button's own label (Create from PDF vs. View source text) needs to
  // reflect this before the modal has ever been opened. Shares the modal's
  // own Source-by-bookId SWR cache entry (same key) so opening the modal
  // right after doesn't re-fetch.
  const { data: sourceData } = useSWR<{ data: Source[] }>(
    book ? `/api/v1/sources?bookId=${encodeURIComponent(book.id)}` : null,
    fetchJson,
  );
  const hasSource = (sourceData?.data.length ?? 0) > 0;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSourceOpened, setImportSourceOpened] = useState(false);

  const notFound = error instanceof HttpError && error.status === 404;

  async function handleSubmit(values: BookFormValues) {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBookWritableFields(values)),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      router.push("/admin/books");
    } catch (err) {
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
          <Button
            variant="default"
            disabled={!book}
            onClick={() => setImportSourceOpened(true)}
            leftSection={
              hasSource ? (
                <Eye size={16} aria-hidden="true" />
              ) : (
                <Upload size={16} aria-hidden="true" />
              )
            }
          >
            {hasSource ? "View source text" : "Create from PDF"}
          </Button>
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
              // Reorder/add/delete aren't persisted from this panel yet
              // (ANA-70 scope boundary -- see modules-panel.tsx) -- Modules
              // now come from the real API, and this card doesn't add fake
              // local mutations on top of that list, so these stay no-ops
              // until a follow-up card wires them to real endpoints.
              <ModulesPanel modules={modules} onModulesChange={() => {}} />
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
