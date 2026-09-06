import type { Book } from "@/lib/books/types";

/**
 * Fixture Books for Storybook stories and tests only (ANA-65). Production
 * routes load real Books from `/api/v1/books` (see books-table.tsx,
 * new/page.tsx, [id]/edit/page.tsx) -- nothing here is read from or written
 * to Firebase/an API/local storage.
 */
export const BOOK_FIXTURES: Book[] = [
  {
    id: "book-1",
    title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
    description: {
      ar: "سيرة النبي محمد صلى الله عليه وسلم.",
      en: "A biography of the Prophet Muhammad.",
    },
    longDescription: {
      ar: "**سيرة** كاملة للنبي محمد صلى الله عليه وسلم.",
      en: "A **full biography** of the Prophet Muhammad.",
    },
    imageId: "sealed-nectar",
    color: "#1c7ed6",
    modules: [],
    isLocked: false,
    isPublished: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
  },
  {
    id: "book-2",
    title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
    description: {
      ar: "مجموعة من الأحاديث النبوية الصحيحة.",
      en: "A collection of authentic prophetic hadiths.",
    },
    longDescription: { ar: "", en: "" },
    imageId: "riyad-as-salihin",
    color: "#2f9e44",
    modules: [],
    isLocked: true,
    isPublished: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
  },
  {
    id: "book-3",
    title: { ar: "قصص الأنبياء", en: "" },
    description: { ar: "", en: "" },
    longDescription: { ar: "", en: "" },
    imageId: "",
    color: "#e8590c",
    modules: [],
    isLocked: false,
    isPublished: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
  },
];

export function buildBookFixture(overrides: Partial<Book> = {}): Book {
  return { ...BOOK_FIXTURES[0], ...overrides };
}
