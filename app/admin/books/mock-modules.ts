/**
 * Display shape for the Book Modules panel (ANA-61, renamed from Sections
 * in ANA-68) -- not the final Module persistence model (see
 * `lib/modules/types.ts` for the real, Firestore-backed `Module`). Add Book
 * (ANA-83) starts its local Modules list empty; Edit Book (ANA-70) maps
 * this same `{ id, title }` shape from real API Modules -- see
 * `[id]/edit/page.tsx`.
 */
export interface MockModule {
  id: string;
  title: string;
}
