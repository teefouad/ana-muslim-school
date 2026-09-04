import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia; Mantine's color-scheme handling reads
// it on mount, so components using MantineProvider need this stubbed.
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

// jsdom doesn't implement ResizeObserver; Mantine's ScrollArea observes size
// on mount, so components using it need this stubbed.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
