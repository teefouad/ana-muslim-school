import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

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

// jsdom doesn't implement Element.scrollIntoView, but dnd-kit's keyboard
// sensor calls it on activation once it finds a scrollable ancestor (the
// Edit Module modal's Lessons list/Lesson editor sit inside a real
// `overflow: auto` region, ANA-117, so this is no longer skipped the way it
// was before that region existed).
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Every AI dialog shows its editable base prompt via `useBasePrompt`
// (ANA-134), which would otherwise GET /api/v1/ai/base-prompt through SWR.
// Stub it globally with a synchronous, stateful equivalent so AI-flow tests
// don't each have to mock that extra request (and their own `fetch` call
// assertions stay about the AI request itself). The real hook is covered by
// components/ui/use-base-prompt.test.tsx via `vi.importActual`.
if (typeof window !== "undefined") {
  vi.mock("@/components/ui/use-base-prompt", async () => {
    const { useState } = await import("react");

    return {
      useBasePrompt: (task: string) => {
        const defaultPrompt = `Default base prompt for ${task}`;
        const [edited, setEdited] = useState<string | null>(null);
        const prompt = edited ?? defaultPrompt;

        return {
          prompt,
          isLoading: false,
          error: null,
          isEdited: edited !== null && edited !== defaultPrompt,
          setPrompt: setEdited,
          reset: () => setEdited(null),
          isReady: prompt.trim().length > 0,
        };
      },
    };
  });
}
