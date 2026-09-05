"use client";

import {
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useComputedColorScheme } from "@mantine/core";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  createRootEditorSubscription$,
  headingsPlugin,
  InsertThematicBreak,
  listsPlugin,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  realmPlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import { $getSelection, $isRangeSelection } from "lexical";

import "@mdxeditor/editor/style.css";

import styles from "./markdown-editor.module.css";
import type { MarkdownEditorHandle } from "./markdown-editor-types";

// A plain mutable box (not a React ref -- see below) holding the root
// editor's live text selection, kept in sync by selectionTrackerPlugin
// without triggering a React re-render on every selection change. Callers
// only read it on demand, via MarkdownEditorHandle.getSelectedText.
interface SelectedTextBox {
  current: string;
}

const selectionTrackerPlugin = realmPlugin<{
  selectedTextBox: SelectedTextBox;
}>({
  init(realm, params) {
    if (!params) return;
    realm.pub(createRootEditorSubscription$, (editor) =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          params.selectedTextBox.current = $isRangeSelection(selection)
            ? selection.getTextContent()
            : "";
        });
      }),
    );
  },
});

export interface MarkdownEditorCoreProps {
  markdown: string;
  onChange: (markdown: string) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  dir?: "ltr" | "rtl";
  className?: string;
  /** Passed as a plain prop rather than a React `ref` because this module is
   * loaded through `next/dynamic` (see markdown-editor.tsx), whose loading
   * wrapper does not forward refs to the lazily-loaded component. */
  handleRef?: Ref<MarkdownEditorHandle>;
}

// The actual MDXEditor-backed implementation. Only ever rendered through
// `MarkdownEditor` (markdown-editor.tsx), which lazy-loads this module on the
// client -- MDXEditor touches browser-only APIs during module init and has
// no SSR support.
export default function MarkdownEditorCore({
  markdown,
  onChange,
  placeholder,
  disabled,
  dir,
  className,
  handleRef,
}: MarkdownEditorCoreProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  // Not a React ref: `realmPlugin` params may be read synchronously by
  // MDXEditor during render (e.g. `init`), which a `useRef` value must not
  // be -- see the `react-hooks/refs` rule. A plain object created once via
  // `useMemo` is a stable, effect-free mutable box with the same lifetime.
  const selectedTextBox = useMemo<SelectedTextBox>(() => ({ current: "" }), []);
  const colorScheme = useComputedColorScheme("dark");

  useImperativeHandle(handleRef, () => ({
    getSelectedText: () => selectedTextBox.current,
    getSelectedMarkdown: () => editorRef.current?.getSelectionMarkdown() ?? "",
  }));

  return (
    <div dir={dir} className={`${styles.container} ${className ?? ""}`}>
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={onChange}
        readOnly={disabled}
        placeholder={placeholder}
        className={
          colorScheme === "dark"
            ? "mantine-markdown-editor dark-theme"
            : "mantine-markdown-editor"
        }
        contentEditableClassName="mantine-markdown-editor__content"
        plugins={[
          headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
          listsPlugin(),
          thematicBreakPlugin(),
          selectionTrackerPlugin({ selectedTextBox }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
                <BlockTypeSelect />
                <ListsToggle options={["bullet", "number"]} />
                <InsertThematicBreak />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
