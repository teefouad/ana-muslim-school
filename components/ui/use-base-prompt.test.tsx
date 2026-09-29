import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vitest.setup.ts stubs this hook globally; these tests exercise the real one.
const { useBasePrompt } =
  await vi.importActual<typeof import("./use-base-prompt")>(
    "./use-base-prompt",
  );

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useBasePrompt", () => {
  it("loads the default prompt for the task and language", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { prompt: "Default prompt" } }),
    );

    const { result } = renderHook(
      () => useBasePrompt("assist.bookDescription", "en"),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReady).toBe(false);

    await waitFor(() => expect(result.current.prompt).toBe("Default prompt"));

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/base-prompt?task=assist.bookDescription&language=en",
    );
    expect(result.current.isReady).toBe(true);
    expect(result.current.isEdited).toBe(false);
  });

  it("returns the edit instead of the default, and resets back to it", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { prompt: "Default prompt" } }),
    );

    const { result } = renderHook(() => useBasePrompt("assist.title"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.setPrompt("My edit"));
    expect(result.current.prompt).toBe("My edit");
    expect(result.current.isEdited).toBe(true);

    act(() => result.current.reset());
    expect(result.current.prompt).toBe("Default prompt");
    expect(result.current.isEdited).toBe(false);
  });

  it("never reports ready when the prompt fails to load, so nothing can be sent blind", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Forbidden" }, 403),
    );

    const { result } = renderHook(() => useBasePrompt("assist.title"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe("Forbidden"));
    expect(result.current.isReady).toBe(false);
  });
});
