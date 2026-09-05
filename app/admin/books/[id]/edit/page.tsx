"use client";

import { useParams, useRouter } from "next/navigation";
import { Divider, Stack, Text, Title } from "@mantine/core";

import {
  BookForm,
  toBookFormValues,
  type BookFormValues,
} from "../../book-form";
import { useBooks } from "../../books-store";

export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { books, updateBook } = useBooks();
  const book = books.find((candidate) => candidate.id === id);

  function handleSubmit(values: BookFormValues) {
    if (!book) return;
    updateBook(book.id, values);
    router.push("/admin/books");
  }

  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>Edit Book</Title>
      <Divider opacity={0.25} mx={-27} />
      {book ? (
        <BookForm
          initialValues={toBookFormValues(book)}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/books")}
        />
      ) : (
        <Text c="dimmed" size="sm">
          This mock book no longer exists in this demo session.
        </Text>
      )}
    </Stack>
  );
}
