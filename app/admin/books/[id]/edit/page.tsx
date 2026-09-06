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

import {
  BookForm,
  toBookFormValues,
  toBookWritableFields,
  type BookFormValues,
} from "../../book-form";
import { fetchJson, HttpError } from "../../fetch-json";
import { INITIAL_MOCK_SECTIONS, type MockSection } from "../../mock-sections";
import { SectionsPanel } from "../../sections-panel";
import type { Book } from "@/lib/books/types";

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
  const [sections, setSections] = useState<MockSection[]>(
    INITIAL_MOCK_SECTIONS,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <Button variant="default" disabled={!book}>
            Import Source
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
            <SectionsPanel sections={sections} onSectionsChange={setSections} />
          </Box>
        </Flex>
      )}
    </Stack>
  );
}
