"use client";

import Link from "next/link";
import { Button, Group, Stack, Title } from "@mantine/core";

import { BooksTable } from "./books-table";

export default function BooksPage() {
  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between">
        <Title order={2}>Books</Title>
        <Button component={Link} href="/admin/books/new">
          Add Book
        </Button>
      </Group>
      <BooksTable />
    </Stack>
  );
}
