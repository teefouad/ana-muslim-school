"use client";

import { useState } from "react";
import { Box, Button, Divider, Flex, Group, Stack, Title } from "@mantine/core";

import { BookForm, type BookFormValues } from "../book-form";
import { useBooks } from "../books-store";
import { INITIAL_MOCK_SECTIONS, type MockSection } from "../mock-sections";
import { SectionsPanel } from "../sections-panel";

const BOOK_FORM_ID = "add-book-form";

// Add Book (ANA-61): header actions (Import Source, Add book/Save changes)
// live on the page and submit the shared BookForm via `form={BOOK_FORM_ID}`.
// The first successful save creates the mock Book in local state and keeps
// rendering this same page -- now in the same saved-book state as Edit Book
// -- rather than navigating away, so Import Source and the Sections panel
// can be exercised in the current session.
export default function AddBookPage() {
  const { addBook, updateBook } = useBooks();
  const [bookId, setBookId] = useState<string | null>(null);
  const [sections, setSections] = useState<MockSection[]>(
    INITIAL_MOCK_SECTIONS,
  );

  function handleSubmit(values: BookFormValues) {
    if (bookId) {
      updateBook(bookId, values);
      return;
    }

    const id = crypto.randomUUID();
    addBook({ id, ...values });
    setBookId(id);
  }

  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={2}>Add Book</Title>
        <Group gap="sm">
          <Button variant="default" disabled={!bookId}>
            Import Source
          </Button>
          <Button type="submit" form={BOOK_FORM_ID}>
            {bookId ? "Save changes" : "Add book"}
          </Button>
        </Group>
      </Group>
      <Divider opacity={0.25} mx={-27} />
      <Flex gap="xl" direction={{ base: "column", md: "row" }} align="stretch">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <BookForm id={BOOK_FORM_ID} onSubmit={handleSubmit} />
        </Box>
        <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
          <SectionsPanel
            sections={sections}
            onSectionsChange={setSections}
            disabled={!bookId}
          />
        </Box>
      </Flex>
    </Stack>
  );
}
