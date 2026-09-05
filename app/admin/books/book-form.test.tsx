import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookForm, createEmptyBookFormValues } from "./book-form";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("BookForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders exactly the requested fields", async () => {
    renderWithProvider(
      <BookForm
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Locked" })).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();

    // Explicitly out of scope per ANA-60.
    expect(screen.queryByText("Short description")).not.toBeInTheDocument();
  });

  it("uses the reusable translatable components for Title and Description, offering Arabic and English", async () => {
    renderWithProvider(
      <BookForm
        initialValues={{
          ...createEmptyBookFormValues(),
          title: { ar: "عنوان", en: "Title" },
          description: { ar: "# نص", en: "# Text" },
        }}
        onSubmit={vi.fn()}
      />,
    );

    // TranslatableTextInput defaults to Arabic.
    expect(screen.getByDisplayValue("عنوان")).toBeInTheDocument();
    // TranslatableTextArea (Markdown) renders "# نص" as a live heading.
    expect(
      await screen.findByRole("heading", { name: "نص" }),
    ).toBeInTheDocument();

    const languageSwitchers = screen.getAllByRole("radiogroup", {
      name: "Language",
    });
    expect(languageSwitchers).toHaveLength(2);
    for (const switcher of languageSwitchers) {
      expect(
        within(switcher).getByRole("radio", { name: "English" }),
      ).toBeInTheDocument();
    }
  });

  it("uses ToggleCard for Locked (error variant) and Published (primary variant)", () => {
    renderWithProvider(
      <BookForm
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );

    const locked = screen.getByRole("switch", { name: "Locked" });
    const published = screen.getByRole("switch", { name: "Published" });

    fireEvent.click(locked);
    fireEvent.click(published);

    expect(locked).toHaveAttribute("aria-checked", "true");
    expect(published).toHaveAttribute("aria-checked", "true");
  });

  it("calls onSubmit with the current field values and makes no network request", () => {
    const onSubmit = vi.fn();
    renderWithProvider(
      <BookForm
        initialValues={{
          ...createEmptyBookFormValues(),
          imageId: "story-1",
        }}
        submitLabel="Add book"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: "story-1" }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders a Cancel button only when onCancel is given", () => {
    const { rerender } = renderWithProvider(
      <BookForm
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();

    rerender(
      <MantineProvider>
        <BookForm
          initialValues={createEmptyBookFormValues()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
