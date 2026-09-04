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
