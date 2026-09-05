import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { LanguageSwitcher } from "./language-switcher";

const LANGUAGES = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test("marks the active language as selected", () => {
  renderWithProvider(
    <LanguageSwitcher languages={LANGUAGES} value="ar" onChange={vi.fn()} />,
  );

  expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "English" })).not.toBeChecked();
});

test("calls onChange with the clicked language's slug", () => {
  const onChange = vi.fn();
  renderWithProvider(
    <LanguageSwitcher languages={LANGUAGES} value="ar" onChange={onChange} />,
  );

  fireEvent.click(screen.getByRole("radio", { name: "English" }));

  expect(onChange).toHaveBeenCalledWith("en");
});

test("disables every option when disabled", () => {
  renderWithProvider(
    <LanguageSwitcher
      languages={LANGUAGES}
      value="ar"
      onChange={vi.fn()}
      disabled
    />,
  );

  for (const radio of screen.getAllByRole("radio")) {
    expect(radio).toBeDisabled();
  }
});

test("omits the filled indicator entirely when isFilled isn't provided", () => {
  const { container } = renderWithProvider(
    <LanguageSwitcher languages={LANGUAGES} value="ar" onChange={vi.fn()} />,
  );

  expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
});
