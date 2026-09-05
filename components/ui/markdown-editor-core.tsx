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
  BoldItalicUnderlineToggles,
  Button,
  convertSelectionToNode$,
  createRootEditorSubscription$,
  currentBlockType$,
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
import { useCellValue, usePublisher } from "@mdxeditor/gurx";
import { $createHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import {
  Heading1,
  Heading2,
  Heading3,
  type LucideIcon,
  Pilcrow,
} from "lucide-react";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
} from "lexical";

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

const BLOCK_TYPE_BUTTONS: ReadonlyArray<{
  value: "paragraph" | HeadingTagType;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "paragraph", label: "Paragraph", icon: Pilcrow },
  { value: "h1", label: "Heading 1", icon: Heading1 },
  { value: "h2", label: "Heading 2", icon: Heading2 },
  { value: "h3", label: "Heading 3", icon: Heading3 },
];

// A button per block type instead of MDXEditor's built-in BlockTypeSelect
// dropdown, so every formatting control in the toolbar is a plain, always-
// visible button (see the module's toolbarContents). Mirrors
// BlockTypeSelect's own conversion logic (convertSelectionToNode$ +
// $createParagraphNode/$createHeadingNode) since that isn't exposed as a
// reusable primitive.
function BlockTypeButtons() {
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const currentBlockType = useCellValue(currentBlockType$);

  return (
    <>
      {BLOCK_TYPE_BUTTONS.map(({ value, label, icon: Icon }) => {
        const isActive = currentBlockType === value;
        return (
          <Button
            key={value}
            aria-label={label}
            aria-pressed={isActive}
            data-state={isActive ? "on" : "off"}
            onClick={() =>
              convertSelectionToNode(() =>
                value === "paragraph"
                  ? $createParagraphNode()
                  : $createHeadingNode(value),
              )
            }
          >
            {/* Button has no fixed size of its own -- it sizes to fixed
                padding plus its icon, and every built-in button's icon is
                24px, so matching that keeps every toolbar button the same
                28x28 footprint. */}
            <Icon size={24} aria-hidden="true" />
          </Button>
        );
      })}
    </>
  );
}

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
                <BlockTypeButtons />
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
