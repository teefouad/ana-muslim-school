import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBooks } from "./books-store";

function Consumer() {
  useBooks();
  return null;
}

describe("useBooks", () => {
  it("throws when used outside a BooksProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(
      "useBooks must be used within a BooksProvider",
    );

    consoleError.mockRestore();
  });
});
