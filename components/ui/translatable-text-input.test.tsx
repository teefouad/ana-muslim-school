import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { TranslatableTextInput } from "./translatable-text-input";
import type { LanguageOption } from "./translatable-value";

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

test("defaults to the Arabic value regardless of the languages prop's order", () => {
  const value = { ar: "عنوان", en: "Title" };

  const { unmount } = renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={AR_FIRST}
      value={value}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByDisplayValue("عنوان")).toBeInTheDocument();
  unmount();

  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={EN_FIRST}
      value={value}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByDisplayValue("عنوان")).toBeInTheDocument();
});

test("falls back to the first language when Arabic isn't offered", () => {
  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={[{ slug: "en", label: "English" }]}
      value={{ en: "Title" }}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByDisplayValue("Title")).toBeInTheDocument();
});

test("switching language shows the other language's value without losing either", () => {
  const onChange = vi.fn();
  const value = { ar: "عنوان", en: "Title" };

  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={EN_FIRST}
      value={value}
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("radio", { name: "English" }));

  expect(screen.getByDisplayValue("Title")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test("editing the active language preserves the other language's value", () => {
  const onChange = vi.fn();
  const value = { ar: "عنوان", en: "Title" };

  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={AR_FIRST}
      value={value}
      onChange={onChange}
    />,
  );

  fireEvent.change(screen.getByDisplayValue("عنوان"), {
    target: { value: "عنوان جديد" },
  });

  expect(onChange).toHaveBeenCalledWith({ ar: "عنوان جديد", en: "Title" });
});

test("reflects filled state per language", () => {
  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={AR_FIRST}
      value={{ en: "Title" }}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("radio", { name: "Arabic" })).toBeInTheDocument();
});

test("disables the input and language switcher when disabled", () => {
  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={AR_FIRST}
      value={{}}
      onChange={vi.fn()}
      disabled
    />,
  );

  expect(screen.getByRole("textbox")).toBeDisabled();
  for (const radio of screen.getAllByRole("radio")) {
    expect(radio).toBeDisabled();
  }
});

test("preserves dir=auto RTL-friendly behavior on the input", () => {
  renderWithProvider(
    <TranslatableTextInput
      label="Title"
      languages={AR_FIRST}
      value={{}}
      onChange={vi.fn()}
    />,
  );

  // Mantine's Input applies `dir` to the input's wrapper element rather than
  // the native <input> itself; either way the input inherits the resulting
  // bidi direction.
  expect(screen.getByRole("textbox").closest("[dir]")).toHaveAttribute(
    "dir",
    "auto",
  );
});

test("renders caller-provided actions beside the language switcher", () => {
  renderWithProvider(
    <TranslatableTextInput
      label="Title"
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
