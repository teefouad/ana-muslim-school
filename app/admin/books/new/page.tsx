"use client";

import { useRouter } from "next/navigation";
import { Stack, Title } from "@mantine/core";

import { BookForm, type BookFormValues } from "../book-form";
import { useBooks } from "../books-store";

export default function AddBookPage() {
  const router = useRouter();
  const { addBook } = useBooks();

  function handleSubmit(values: BookFormValues) {
    addBook({ id: crypto.randomUUID(), ...values });
    router.push("/admin/books");
  }

  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>Add Book</Title>
      <BookForm
        submitLabel="Add book"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/books")}
      />
    </Stack>
  );
}
