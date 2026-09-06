/**
 * Frontend-only fixture data for the Book Modules panel (ANA-61, renamed
 * from Sections in ANA-68). This shape only exists to exercise the panel's
 * local reorder/add behavior -- it is not the final Module persistence
 * model (see `lib/modules/types.ts` for the real, Firestore-backed
 * `Module`). Nothing here is read from or written to Firebase/an API/local
 * storage.
 */
export interface MockModule {
  id: string;
  title: string;
}

export const INITIAL_MOCK_MODULES: MockModule[] = [
  { id: "module-1", title: "Introduction" },
  { id: "module-2", title: "Prayer basics" },
  { id: "module-3", title: "Summary" },
];
