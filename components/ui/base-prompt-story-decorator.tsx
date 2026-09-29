import type { ReactElement } from "react";

// Storybook has no API, so AI dialogs that show their base prompt (ANA-134,
// via `useBasePrompt`) would otherwise render the "couldn't load" error.
// Stubs the one endpoint they read; a story's own `fetch` stub, if any,
// runs later and takes over.
export function withBasePromptStub(Story: () => ReactElement): ReactElement {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          prompt:
            "Suggest or improve the text of this field.\n\n- Return only the text itself, with no preamble or commentary.",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  return <Story />;
}
