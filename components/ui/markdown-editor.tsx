"use client";

import { forwardRef } from "react";
import dynamic from "next/dynamic";

import type { MarkdownEditorCoreProps } from "./markdown-editor-core";
import type { MarkdownEditorHandle } from "./markdown-editor-types";

export type { MarkdownEditorHandle } from "./markdown-editor-types";

// MDXEditor touches browser-only APIs during module init and has no SSR
// support, so it's loaded only on the client (Next.js App Router's
// client-only/dynamic-import pattern, `ssr: false`) -- callers can use
// `MarkdownEditor` like any other component without knowing about that
// constraint.
const MarkdownEditorCore = dynamic(() => import("./markdown-editor-core"), {
  ssr: false,
});

export type MarkdownEditorProps = Omit<MarkdownEditorCoreProps, "handleRef">;

// A Markdown-backed WYSIWYG editor (via MDXEditor) with a small formatting
// toolbar. The stored/exposed value is always a Markdown string -- HTML is
// never the canonical value. See TranslatableTextArea for the
// language-switching multiline field built on top of this.
export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(props, ref) {
  // `next/dynamic`'s loading wrapper is a plain function component and does
  // not forward a `ref` prop down to the lazily-loaded component, so the
  // handle is passed through as a normal prop instead (see
  // markdown-editor-core.tsx's `handleRef`).
  return <MarkdownEditorCore {...props} handleRef={ref} />;
});
