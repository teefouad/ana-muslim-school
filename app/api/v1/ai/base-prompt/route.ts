import { NextResponse } from "next/server";

import { isAiPromptTask } from "@/lib/ai/base-prompt-tasks";
import { getBasePrompt } from "@/lib/ai/base-prompts";
import { requireBooksPermission } from "@/lib/auth/require-books-permission";

/**
 * Returns the default base prompt an AI action will send (ANA-134), so the
 * admin can read and edit it before the request is made. `task` picks the
 * action (see `AI_PROMPT_TASKS`); `language` ("ar" | "en", default "ar")
 * only affects the language-parameterized Book description prompts. Same
 * `books.update` gate as the AI routes that consume the edited prompt.
 */
export async function GET(request: Request) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const params = new URL(request.url).searchParams;
  const task = params.get("task");
  const language = params.get("language") ?? "ar";

  if (!isAiPromptTask(task)) {
    return NextResponse.json({ error: "Unknown `task`." }, { status: 400 });
  }

  if (language !== "ar" && language !== "en") {
    return NextResponse.json(
      { error: '`language` must be "ar" or "en".' },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: { prompt: getBasePrompt(task, language) } });
}
