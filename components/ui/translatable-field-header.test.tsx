import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { TranslatableFieldHeader } from "./translatable-field-header";
import type { LanguageOption } from "./translatable-value";

const LANGUAGES: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test("renders the label and language switcher", () => {
  renderWithProvider(
    <TranslatableFieldHeader
      label="Title"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={vi.fn()}
      isFilled={() => false}
    />,
  );

  expect(screen.getByText("Title")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
});

test("associates the label with htmlFor when provided", () => {
  renderWithProvider(
    <TranslatableFieldHeader
      label="Title"
      htmlFor="title-input"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={vi.fn()}
      isFilled={() => false}
    />,
  );

  expect(screen.getByText("Title").tagName).toBe("LABEL");
  expect(screen.getByText("Title")).toHaveAttribute("for", "title-input");
});

test("renders as a plain paragraph without htmlFor", () => {
  renderWithProvider(
    <TranslatableFieldHeader
      label="Description"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={vi.fn()}
      isFilled={() => false}
    />,
  );

  expect(screen.getByText("Description").tagName).toBe("P");
});

test("calls onActiveSlugChange when the switcher is clicked", () => {
  const onActiveSlugChange = vi.fn();

  renderWithProvider(
    <TranslatableFieldHeader
      label="Title"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={onActiveSlugChange}
      isFilled={() => false}
    />,
  );

  fireEvent.click(screen.getByRole("radio", { name: "English" }));

  expect(onActiveSlugChange).toHaveBeenCalledWith("en");
});

test("renders caller-provided actions between the label and the switcher", () => {
  renderWithProvider(
    <TranslatableFieldHeader
      label="Title"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={vi.fn()}
      isFilled={() => false}
      actions={<button>Translate</button>}
    />,
  );

  expect(screen.getByRole("button", { name: "Translate" })).toBeInTheDocument();
});

test("disables the language switcher when disabled", () => {
  renderWithProvider(
    <TranslatableFieldHeader
      label="Title"
      languages={LANGUAGES}
      activeSlug="ar"
      onActiveSlugChange={vi.fn()}
      isFilled={() => false}
      disabled
    />,
  );

  for (const radio of screen.getAllByRole("radio")) {
    expect(radio).toBeDisabled();
  }
});
