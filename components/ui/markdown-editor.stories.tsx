import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, Stack, Text } from "@mantine/core";

import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

const meta = {
  title: "UI/MarkdownEditor",
  component: MarkdownEditor,
  tags: ["autodocs"],
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledEditor(props: { markdown?: string; disabled?: boolean }) {
  const [markdown, setMarkdown] = useState(props.markdown ?? "");
  return (
    <div style={{ width: 480 }}>
      <MarkdownEditor
        markdown={markdown}
        onChange={setMarkdown}
        disabled={props.disabled}
        placeholder="Write something…"
      />
    </div>
  );
}

export const Empty: Story = {
  args: { markdown: "", onChange: () => {} },
  render: () => <ControlledEditor />,
};

export const HeadingsListsAndBold: Story = {
  args: { markdown: "", onChange: () => {} },
  render: () => (
    <ControlledEditor
      markdown={[
        "# The Sealed Nectar",
        "",
        "A **biography** of the Prophet Muhammad, peace be upon him.",
        "",
        "## Contents",
        "",
        "1. Pre-Islamic Arabia",
        "2. The birth and early life",
        "",
        "- Family",
        "- Tribe",
        "",
        "---",
        "",
        "*Awarded first prize by the Muslim World League.*",
      ].join("\n")}
    />
  ),
};

export const Disabled: Story = {
  args: { markdown: "", onChange: () => {} },
  render: () => <ControlledEditor markdown="# Read-only content" disabled />,
};

export const SelectionExtraction: Story = {
  args: { markdown: "", onChange: () => {} },
  render: function Render() {
    const editorRef = useRef<MarkdownEditorHandle>(null);
    const [selection, setSelection] = useState<{
      text: string;
      markdown: string;
    } | null>(null);

    return (
      <Stack style={{ width: 480 }}>
        <Text size="sm" c="dimmed">
          Select some text below, then click the button to read it out through
          the editor&apos;s public API -- the same API a future &quot;Create
          section from selection&quot; or &quot;Generate quiz from
          selection&quot; action would use.
        </Text>
        <MarkdownEditor
          ref={editorRef}
          markdown="Select **some** of this text, then click the button below."
          onChange={() => {}}
        />
        <Button
          onClick={() =>
            setSelection({
              text: editorRef.current?.getSelectedText() ?? "",
              markdown: editorRef.current?.getSelectedMarkdown() ?? "",
            })
          }
        >
          Read current selection
        </Button>
        {selection && (
          <Text size="sm" component="pre">
            {JSON.stringify(selection, null, 2)}
          </Text>
        )}
      </Stack>
    );
  },
};
