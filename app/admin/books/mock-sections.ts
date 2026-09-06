/**
 * Frontend-only fixture data for the Book Sections panel (ANA-61). This
 * shape only exists to exercise the panel's local reorder/add behavior --
 * it is not a final Sections persistence model, which will be designed
 * separately when Sections moves to Firestore. Nothing here is read from or
 * written to Firebase/an API/local storage.
 */
export interface MockSection {
  id: string;
  title: string;
}

export const INITIAL_MOCK_SECTIONS: MockSection[] = [
  { id: "section-1", title: "Introduction" },
  { id: "section-2", title: "Prayer basics" },
  { id: "section-3", title: "Summary" },
];
