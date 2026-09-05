import type { TranslatedValue } from "@/components/ui/translatable-value";

/**
 * Frontend-only fixture data for the Books CRUD UI (ANA-60). This shape only
 * needs to support this mock UI -- it is not the final Books persistence
 * model, which will be designed separately when Books moves to Firestore.
 * Nothing here is read from or written to Firebase/an API/local storage.
 */
export interface MockBook {
  id: string;
  title: TranslatedValue;
  description: TranslatedValue;
  imageId: string;
  locked: boolean;
  published: boolean;
  color: string;
}

export const INITIAL_MOCK_BOOKS: MockBook[] = [
  {
    id: "book-1",
    title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
    description: {
      ar: "**سيرة** النبي محمد صلى الله عليه وسلم.",
      en: "A **biography** of the Prophet Muhammad.",
    },
    imageId: "sealed-nectar",
    locked: false,
    published: true,
    color: "#1c7ed6",
  },
  {
    id: "book-2",
    title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
    description: {
      ar: "مجموعة من الأحاديث النبوية الصحيحة.",
      en: "A collection of authentic prophetic hadiths.",
    },
    imageId: "riyad-as-salihin",
    locked: true,
    published: false,
    color: "#2f9e44",
  },
  {
    id: "book-3",
    title: { ar: "قصص الأنبياء", en: "" },
    description: { ar: "", en: "" },
    imageId: "",
    locked: false,
    published: false,
    color: "#e8590c",
  },
];
