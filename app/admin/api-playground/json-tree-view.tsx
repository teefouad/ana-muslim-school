"use client";

import dynamic from "next/dynamic";
import type { ReactJsonViewProps } from "@microlink/react-json-view";

// @microlink/react-json-view (via its react-textarea-autosize dependency)
// reads `document.documentElement.currentStyle` at module top-level with no
// SSR guard, which crashes any route that imports it directly with
// "document is not defined" as soon as that route is server-rendered --
// /admin/api-playground is a dynamic route (server-rendered on every
// request), so this isn't a build-time-only concern. Loaded client-only
// instead, matching the established pattern for browser-only dependencies
// (see components/ui/markdown-editor.tsx).
export const JsonTreeView = dynamic<ReactJsonViewProps>(
  () => import("@microlink/react-json-view"),
  { ssr: false },
);
