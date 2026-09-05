import type { ReactNode } from "react";

import { BooksProvider } from "./books-store";

export default function BooksLayout({ children }: { children: ReactNode }) {
  return <BooksProvider>{children}</BooksProvider>;
}
