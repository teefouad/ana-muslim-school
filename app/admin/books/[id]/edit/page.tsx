"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import {
  BookForm,
  toBookFormValues,
  type BookFormValues,
} from "../../book-form";
import { useBooks } from "../../books-store";
import { INITIAL_MOCK_SECTIONS, type MockSection } from "../../mock-sections";
import { SectionsPanel } from "../../sections-panel";

const BOOK_FORM_ID = "edit-book-form";

// Edit Book (ANA-61): header actions (Import Source, Save changes) submit
// the shared BookForm via `form={BOOK_FORM_ID}`. Import Source is only an
// entry point here -- the source-import/OCR workflow behind it is a
// separate card.
export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { books, updateBook } = useBooks();
  const book = books.find((candidate) => candidate.id === id);
  const [sections, setSections] = useState<MockSection[]>(
    INITIAL_MOCK_SECTIONS,
  );

  function handleSubmit(values: BookFormValues) {
    if (!book) return;
    updateBook(book.id, values);
    router.push("/admin/books");
  }

  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={2}>Edit Book</Title>
        <Group gap="sm">
          <Button variant="default" disabled={!book}>
            Import Source
          </Button>
          <Button type="submit" form={BOOK_FORM_ID} disabled={!book}>
            Save changes
          </Button>
        </Group>
      </Group>
      <Divider opacity={0.25} mx={-27} />
      {book ? (
        <Flex
          gap="xl"
          direction={{ base: "column", md: "row" }}
          align="flex-start"
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
      ) : (
        <Text c="dimmed" size="sm">
          This mock book no longer exists in this demo session.
        </Text>
      )}
    </Stack>
  );
}
