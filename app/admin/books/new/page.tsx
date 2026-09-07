"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Title,
} from "@mantine/core";

import {
  BookForm,
  createEmptyBookFormValues,
  toBookWritableFields,
  type BookFormValues,
} from "../book-form";
import { INITIAL_MOCK_MODULES, type MockModule } from "../mock-modules";
import { ModulesPanel } from "../modules-panel";
import type { Book } from "@/lib/books/types";

const BOOK_FORM_ID = "add-book-form";

// Add Book (ANA-65): creates through `POST /api/v1/books` and hands off to
// the normal Edit Book surface for the server-returned id -- Import Source
// and the Modules panel stay disabled here since a Book must exist (and
// have a real id) before either can do anything, and this page never keeps
// rendering a "saved" state of its own after a successful create.
export default function AddBookPage() {
  const router = useRouter();
  const [modules, setModules] = useState<MockModule[]>(INITIAL_MOCK_MODULES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: BookFormValues) {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBookWritableFields(values)),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      const { data: book } = (await response.json()) as { data: Book };
      router.replace(`/admin/books/${book.id}/edit`);
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
        <Title order={2}>Add Book</Title>
        <Group gap="sm">
          <Button variant="default" disabled>
            Import Source
          </Button>
          <Button type="submit" form={BOOK_FORM_ID} loading={isSubmitting}>
            Add book
          </Button>
        </Group>
      </Group>
      <Divider opacity={0.25} mx={-27} />
      {submitError && <Alert color="red">{submitError}</Alert>}
      <Flex gap="xl" direction={{ base: "column", md: "row" }} align="stretch">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <BookForm
            id={BOOK_FORM_ID}
            initialValues={createEmptyBookFormValues()}
            onSubmit={handleSubmit}
          />
        </Box>
        <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
          <ModulesPanel
            modules={modules}
            onModulesChange={setModules}
            disabled
          />
        </Box>
      </Flex>
    </Stack>
  );
}
