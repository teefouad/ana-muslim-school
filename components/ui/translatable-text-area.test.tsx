import { type RefObject, createRef, useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import {
  TranslatableTextArea,
  type TranslatableTextAreaHandle,
} from "./translatable-text-area";
import type { LanguageOption, TranslatedValue } from "./translatable-value";

const AR_FIRST: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const EN_FIRST: LanguageOption[] = [
  { slug: "en", label: "English" },
  { slug: "ar", label: "Arabic" },
];

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test("defaults to the Arabic value regardless of the languages prop's order", async () => {
  const value = { ar: "# عنوان", en: "# Title" };

  const { unmount } = renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={AR_FIRST}
      value={value}
      onChange={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole("heading", { name: "عنوان" }),
  ).toBeInTheDocument();
  unmount();

  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={EN_FIRST}
      value={value}
      onChange={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole("heading", { name: "عنوان" }),
  ).toBeInTheDocument();
});

test("falls back to the first language when Arabic isn't offered", async () => {
  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={[{ slug: "en", label: "English" }]}
      value={{ en: "# Title" }}
      onChange={vi.fn()}
    />,
  );

  expect(
    await screen.findByRole("heading", { name: "Title" }),
  ).toBeInTheDocument();
});

test("switching languages shows the other language's content without losing either, or overwriting values", async () => {
  const onChange = vi.fn();
  const value = { ar: "# عنوان", en: "# Title" };

  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={EN_FIRST}
      value={value}
      onChange={onChange}
    />,
  );

  expect(
    await screen.findByRole("heading", { name: "عنوان" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Title")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: "English" }));

  expect(
    await screen.findByRole("heading", { name: "Title" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("عنوان")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test("editing the active language preserves the other language's value", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const value = { ar: "عنوان", en: "Title" };

  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={AR_FIRST}
      value={value}
      onChange={onChange}
    />,
  );

  const editable = await screen.findByRole("textbox");
  await user.click(editable);
  await user.type(editable, "!");

  expect(onChange).toHaveBeenLastCalledWith({ ar: "عنوان!", en: "Title" });
});

test("uses RTL direction for Arabic and LTR for other languages", async () => {
  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={EN_FIRST}
      value={{ ar: "عنوان", en: "Title" }}
      onChange={vi.fn()}
    />,
  );

  const editable = await screen.findByRole("textbox");
  expect(editable.closest("[dir]")).toHaveAttribute("dir", "rtl");

  fireEvent.click(screen.getByRole("radio", { name: "English" }));

  const englishEditable = await screen.findByRole("textbox");
  expect(englishEditable.closest("[dir]")).toHaveAttribute("dir", "ltr");
});

test("exposes the active language's selection through the ref", async () => {
  const ref = createRef<TranslatableTextAreaHandle>();

  renderWithProvider(
    <TranslatableTextArea
      ref={ref as RefObject<TranslatableTextAreaHandle>}
      label="Description"
      languages={AR_FIRST}
      value={{ ar: "Hello world" }}
      onChange={vi.fn()}
    />,
  );

  const editable = await screen.findByRole("textbox");
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));

  await vi.waitFor(() => expect(ref.current?.getSelectedText()).toBe("Hello"));
  expect(ref.current?.getSelectedMarkdown()).toBe("Hello");
});

test("disables the editor and language switcher when disabled", async () => {
  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={AR_FIRST}
      value={{}}
      onChange={vi.fn()}
      disabled
    />,
  );

  const editable = await screen.findByRole("textbox");
  expect(editable).toHaveAttribute("contenteditable", "false");

  const languageSwitcher = screen.getByRole("radiogroup", {
    name: "Language",
  });
  for (const radio of within(languageSwitcher).getAllByRole("radio")) {
    expect(radio).toBeDisabled();
  }
});

test("reflects a parent-driven value change while the same language stays active", async () => {
  const { rerender } = renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={AR_FIRST}
      value={{ ar: "Original" }}
      onChange={vi.fn()}
    />,
  );

  expect(await screen.findByText("Original")).toBeInTheDocument();

  // Simulates a form reset / loading a different record / a future
  // Translate action -- something other than the editor's own onChange
  // replacing value.ar while Arabic remains the active language (no
  // language switch, so no remount to pick up the new initial markdown).
  rerender(
    <MantineProvider>
      <TranslatableTextArea
        label="Description"
        languages={AR_FIRST}
        value={{ ar: "Replaced externally" }}
        onChange={vi.fn()}
      />
    </MantineProvider>,
  );

  expect(await screen.findByText("Replaced externally")).toBeInTheDocument();
  expect(screen.queryByText("Original")).not.toBeInTheDocument();
});

test("continues to reflect typing after the parent echoes an edit back as props", async () => {
  const user = userEvent.setup();

  function Harness() {
    const [value, setValue] = useState<TranslatedValue>({ ar: "Hello" });
    return (
      <TranslatableTextArea
        label="Description"
        languages={AR_FIRST}
        value={value}
        onChange={setValue}
      />
    );
  }

  renderWithProvider(<Harness />);

  const editable = await screen.findByRole("textbox");
  await user.click(editable);
  await user.type(editable, " world");

  // If the parent-update sync effect fought the editor's own onChange
  // round-tripping back through props, typing would keep getting reset
  // instead of accumulating.
  await vi.waitFor(() => expect(editable).toHaveTextContent("Hello world"));
});

test("renders caller-provided actions beside the language switcher", async () => {
  renderWithProvider(
    <TranslatableTextArea
      label="Description"
      languages={AR_FIRST}
      value={{}}
      onChange={vi.fn()}
      actions={(activeSlug) => <button>Translate to {activeSlug}</button>}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Translate to ar" }),
  ).toBeInTheDocument();
});
