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

test("exposes only the intended toolbar controls, all as plain buttons", async () => {
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={vi.fn()} />);

  const toolbar = await screen.findByRole("toolbar");
  expect(within(toolbar).queryAllByRole("combobox")).toHaveLength(0);

  const controls = within(toolbar)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .concat(
      within(toolbar)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label")),
    );

  expect(new Set(controls)).toEqual(
    new Set([
      "Undo Ctrl+Z",
      "Redo Ctrl+Y",
      "Bold",
      "Italic",
      "Paragraph",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Bulleted list",
      "Numbered list",
      "Insert thematic break",
    ]),
  );
});

test("has no tooltips on any toolbar control", async () => {
  const user = userEvent.setup();
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={vi.fn()} />);

  const boldButton = await screen.findByRole("radio", { name: "Bold" });
  await user.hover(boldButton);
  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

test("switches between block types via buttons instead of a dropdown", async () => {
  const user = userEvent.setup();
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={vi.fn()} />);

  // Converting a block type acts on the current selection, so the editor
  // needs focus/a cursor placed in it first.
  await user.click(await screen.findByRole("textbox"));
  await user.click(await screen.findByRole("button", { name: "Heading 1" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Hello" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Heading 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
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

test("insertMarkdown replaces the current selection, leaving the rest of the document untouched", async () => {
  const ref = createRef<MarkdownEditorHandle>();
  const onChange = vi.fn();
  renderWithProvider(
    <MarkdownEditor
      ref={ref as RefObject<MarkdownEditorHandle>}
      markdown="Hello world"
      onChange={onChange}
    />,
  );

  const editable = await screen.findByRole("textbox");
  await userEvent.setup().click(editable);
  selectFirstCharacters(editable, 5);
  await vi.waitFor(() => expect(ref.current?.getSelectedText()).toBe("Hello"));

  ref.current?.insertMarkdown("Goodbye");

  await vi.waitFor(() =>
    expect(onChange).toHaveBeenLastCalledWith("Goodbye world", false),
  );
});

test("omits the full-height layout by default", async () => {
  const { container } = renderWithProvider(
    <MarkdownEditor markdown="Hello" onChange={vi.fn()} />,
  );

  // MarkdownEditor is loaded via next/dynamic({ ssr: false }) (see
  // markdown-editor.tsx), so .mdxeditor isn't necessarily in the DOM yet
  // right after render -- await the editor actually mounting first.
  await screen.findByRole("textbox");

  expect(container.querySelector(".mdxeditor")).not.toHaveClass(
    "mdxeditor-full-height",
  );
});

test("fillHeight applies MDXEditor's own full-height layout, without disturbing the toolbar", async () => {
  // Regression test (ANA-70): the Learning Material editor needs its
  // contenteditable area to grow and fill the available height (so
  // clicking empty space below the text still focuses it) -- fillHeight
  // wires MDXEditor's own `mdxeditor-full-height` class for that, rather
  // than an overlay that could intercept toolbar clicks.
  const { container } = renderWithProvider(
    <MarkdownEditor markdown="Hello" onChange={vi.fn()} fillHeight />,
  );

  // Await the editor actually mounting (see the previous test) before
  // asserting on .mdxeditor's classes.
  const boldButton = await screen.findByRole("radio", { name: "Bold" });
  expect(container.querySelector(".mdxeditor")).toHaveClass(
    "mdxeditor-full-height",
  );
  expect(boldButton).toBeEnabled();
});

test("focuses the editor when empty body whitespace is clicked, not just the first line (ANA-75)", async () => {
  const user = userEvent.setup();
  const { container } = renderWithProvider(
    <MarkdownEditor markdown="Hello" onChange={vi.fn()} />,
  );

  const editable = await screen.findByRole("textbox");
  expect(editable).not.toHaveFocus();

  const body = container.querySelector(".mdxeditor-root-contenteditable");
  expect(body).not.toBeNull();
  await user.click(body as HTMLElement);

  expect(editable).toHaveFocus();
});

test("does not focus a disabled editor when its empty body is clicked (ANA-75)", async () => {
  const user = userEvent.setup();
  const { container } = renderWithProvider(
    <MarkdownEditor markdown="Hello" onChange={vi.fn()} disabled />,
  );

  const editable = await screen.findByRole("textbox");
  const body = container.querySelector(".mdxeditor-root-contenteditable");
  expect(body).not.toBeNull();
  await user.click(body as HTMLElement);

  expect(editable).not.toHaveFocus();
});

test("still lets a direct toolbar click through the body focus fix (ANA-75)", async () => {
  const user = userEvent.setup();
  renderWithProvider(<MarkdownEditor markdown="Hello" onChange={vi.fn()} />);

  const editable = await screen.findByRole("textbox");
  await user.click(editable);
  selectFirstCharacters(editable, 5);
  await user.click(await screen.findByRole("button", { name: "Heading 1" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Hello" }),
  ).toBeInTheDocument();
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
