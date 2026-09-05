import { type RefObject, createRef } from "react";
import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { MarkdownEditor } from "./markdown-editor";
import type { MarkdownEditorHandle } from "./markdown-editor-types";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Selects the first `length` characters of the editor's first text node
// directly through the native Selection API -- jsdom doesn't support real
// cursor movement inside a contenteditable via simulated keyboard input
// (arrow keys, Home/End), so driving selection through user-event isn't an
// option here.
function selectFirstCharacters(root: HTMLElement, length: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

test("renders the initial markdown live-formatted, not as raw syntax", async () => {
  renderWithProvider(<MarkdownEditor markdown="# Hello" onChange={vi.fn()} />);

  const heading = await screen.findByRole("heading", { level: 1 });
  expect(heading).toHaveTextContent("Hello");
});

test("emits edits as a Markdown string", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={onChange} />);

  const editable = await screen.findByRole("textbox");
  await user.click(editable);
  await user.type(editable, "!");

  expect(onChange).toHaveBeenLastCalledWith("Hello!", false);
});

test("exposes only the intended toolbar controls", async () => {
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={vi.fn()} />);

  const toolbar = await screen.findByRole("toolbar");
  const controls = within(toolbar)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .concat(
      within(toolbar)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label")),
    )
    .concat(
      within(toolbar)
        .getAllByRole("combobox")
        .map((combobox) => combobox.getAttribute("aria-label")),
    );

  expect(new Set(controls)).toEqual(
    new Set([
      "Undo Ctrl+Z",
      "Redo Ctrl+Y",
      "Bold",
      "Italic",
      "Block type",
      "Bulleted list",
      "Numbered list",
      "Insert thematic break",
    ]),
  );
});

test("disables editing when disabled", async () => {
  renderWithProvider(
    <MarkdownEditor markdown="Hello" onChange={vi.fn()} disabled />,
  );

  const editable = await screen.findByRole("textbox");
  expect(editable).toHaveAttribute("contenteditable", "false");
});

test("returns the current selection as plain text and Markdown", async () => {
  const ref = createRef<MarkdownEditorHandle>();
  renderWithProvider(
    <MarkdownEditor
      ref={ref as RefObject<MarkdownEditorHandle>}
      markdown="Hello **world**"
      onChange={vi.fn()}
    />,
  );

  const editable = await screen.findByRole("textbox");
  await userEvent.setup().click(editable);
  selectFirstCharacters(editable, 5);
  await vi.waitFor(() => expect(ref.current?.getSelectedText()).toBe("Hello"));

  expect(ref.current?.getSelectedMarkdown()).toBe("Hello");
});

test("returns empty strings when there is no selection", async () => {
  const ref = createRef<MarkdownEditorHandle>();
  renderWithProvider(
    <MarkdownEditor
      ref={ref as RefObject<MarkdownEditorHandle>}
      markdown="Hello"
      onChange={vi.fn()}
    />,
  );

  await screen.findByRole("textbox");

  expect(ref.current?.getSelectedText()).toBe("");
  expect(ref.current?.getSelectedMarkdown()).toBe("");
});
