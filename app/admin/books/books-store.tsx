"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { INITIAL_MOCK_BOOKS, type MockBook } from "./mock-books";

interface BooksContextValue {
  books: MockBook[];
  addBook: (book: MockBook) => void;
  updateBook: (id: string, values: Omit<MockBook, "id">) => void;
  removeBook: (id: string) => void;
}

const BooksContext = createContext<BooksContextValue | null>(null);

// In-memory-only store for the Books CRUD UI mock data (ANA-60). Scoped to
// /admin/books/* via app/admin/books/layout.tsx, so it resets whenever that
// section is freshly loaded and is never read from or written to Firebase,
// an API, or browser storage.
export function BooksProvider({
  children,
  initialBooks = INITIAL_MOCK_BOOKS,
}: {
  children: ReactNode;
  /** Overrides the seeded fixture data -- primarily for Storybook and tests. */
  initialBooks?: MockBook[];
}) {
  const [books, setBooks] = useState<MockBook[]>(initialBooks);

  const value = useMemo<BooksContextValue>(
    () => ({
      books,
      addBook: (book) => setBooks((prev) => [...prev, book]),
      updateBook: (id, values) =>
        setBooks((prev) =>
          prev.map((book) => (book.id === id ? { ...values, id } : book)),
        ),
      removeBook: (id) =>
        setBooks((prev) => prev.filter((book) => book.id !== id)),
    }),
    [books],
  );

  return (
    <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
  );
}

export function useBooks(): BooksContextValue {
  const context = useContext(BooksContext);

  if (!context) {
    throw new Error("useBooks must be used within a BooksProvider");
  }

  return context;
}
