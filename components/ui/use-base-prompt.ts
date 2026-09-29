"use client";

import { useState } from "react";
import useSWR from "swr";

import { fetchJson } from "@/app/admin/books/fetch-json";
import type { AiPromptTask } from "@/lib/ai/base-prompt-tasks";

export interface BasePromptState {
  /** The prompt that will be sent: the admin's edit if any, otherwise the
   * server's default. Empty until the default has loaded. */
  prompt: string;
  isLoading: boolean;
  error: string | null;
  isEdited: boolean;
  setPrompt: (value: string) => void;
  reset: () => void;
  /** True once there is a non-blank prompt to send. */
  isReady: boolean;
}

/**
 * Loads an AI action's default base prompt (ANA-134) and holds the admin's
 * edits to it. Every AI dialog uses this so the prompt is always shown --
 * and editable -- before a request is sent, and the value returned here is
 * exactly what gets submitted as `basePrompt`.
 */
export function useBasePrompt(
  task: AiPromptTask,
  language?: string,
): BasePromptState {
  const query = new URLSearchParams({ task });

  if (language) {
    query.set("language", language);
  }

  const { data, error, isLoading } = useSWR<{ data: { prompt: string } }>(
    `/api/v1/ai/base-prompt?${query}`,
    fetchJson,
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  const [edited, setEdited] = useState<string | null>(null);

  const prompt = edited ?? data?.data.prompt ?? "";

  return {
    prompt,
    isLoading,
    error: error ? (error as Error).message : null,
    isEdited: edited !== null && edited !== data?.data.prompt,
    setPrompt: setEdited,
    reset: () => setEdited(null),
    isReady: prompt.trim().length > 0,
  };
}
