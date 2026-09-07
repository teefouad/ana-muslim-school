import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia, but Mantine's MantineProvider reads it
// (for color-scheme detection) as soon as it mounts.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement ResizeObserver, but Mantine's ScrollArea (used by
// e.g. Table.ScrollContainer) observes size as soon as it mounts.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement document.fonts, but Mantine's autosize Textarea
// (used by module-card.tsx's Module text, ANA-68) listens for font-load
// events on it as soon as it mounts.
if (typeof document !== "undefined" && !document.fonts) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

// jsdom doesn't implement IntersectionObserver, but the Import Source
// modal's PdfPageCanvas (ANA-68) observes visibility to lazily render PDF
// pages/thumbnails as soon as it mounts.
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof window.IntersectionObserver;
}

// jsdom doesn't implement layout, so it has no Range.getBoundingClientRect/
// getClientRects at all -- but Lexical (the Markdown editor's underlying
// engine, see components/ui/markdown-editor.tsx) calls them to sync the DOM
// selection after selection-changing commands (e.g. select-all).
if (typeof Range !== "undefined" && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  });
}
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
