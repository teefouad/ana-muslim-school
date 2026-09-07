import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfPageCanvas } from "./pdf-page-canvas";

const fakeDoc = {} as PdfDocument;

describe("PdfPageCanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders normally when IntersectionObserver is available", () => {
    render(<PdfPageCanvas doc={fakeDoc} pageNumber={1} targetWidth={200} />);

    expect(screen.getByTestId("pdf-page-canvas-1")).toBeInTheDocument();
  });

  it("degrades to eager rendering instead of throwing when IntersectionObserver is unavailable", () => {
    const original = window.IntersectionObserver;
    // @ts-expect-error -- simulating an older browser/runtime without it.
    delete window.IntersectionObserver;

    expect(() =>
      render(<PdfPageCanvas doc={fakeDoc} pageNumber={1} targetWidth={200} />),
    ).not.toThrow();
    expect(screen.getByTestId("pdf-page-canvas-1")).toBeInTheDocument();

    window.IntersectionObserver = original;
  });
});
