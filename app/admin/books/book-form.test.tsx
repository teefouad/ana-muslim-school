import { fireEvent, render, screen, within } from "@testing-library/react";
import { Button, MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BookForm,
  createEmptyBookFormValues,
  toBookWritableFields,
} from "./book-form";

const FORM_ID = "test-book-form";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// The Add/Edit Book pages submit this form from a header button outside the
// form itself, via the HTML `form` attribute (ANA-61) -- reproduce that here
// rather than reaching into the component internals to submit it.
function renderWithExternalSubmit(ui: React.ReactElement) {
  return renderWithProvider(
    <>
      {ui}
      <Button type="submit" form={FORM_ID}>
        Submit
      </Button>
    </>,
  );
}

describe("BookForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders exactly the requested fields, in order", async () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Long description")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Locked" })).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();

    // Title, Description, Long description, In-app image ID, Color,
    // Locked, Published -- in that order. Color stays paired with In-app
    // image ID (its pre-ANA-65 position) rather than the order the ANA-65
    // ticket text listed, at the project owner's explicit request.
    const labelOrder = [
      "Title",
      "Description",
      "Long description",
      "In-app image ID",
      "Color",
      "Locked",
      "Published",
    ];
    const elements = labelOrder.map(
      (label) => screen.queryByText(label) ?? screen.getByLabelText(label),
    );
    for (let i = 0; i < elements.length - 1; i += 1) {
      const position = elements[i].compareDocumentPosition(elements[i + 1]);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("renders no bottom submit or Cancel buttons of its own", () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the reusable translatable text input for both Title and Description, offering Arabic and English", async () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={{
          ...createEmptyBookFormValues(),
          title: { ar: "عنوان", en: "Title" },
          description: { ar: "وصف", en: "Description" },
        }}
        onSubmit={vi.fn()}
      />,
    );

    // Both default to Arabic and render as plain text inputs, not Markdown.
    expect(screen.getByDisplayValue("عنوان")).toBeInTheDocument();
    expect(screen.getByDisplayValue("وصف")).toBeInTheDocument();

    const languageSwitchers = screen.getAllByRole("radiogroup", {
      name: "Language",
    });
    // Title, Description, and Long description each get their own switcher.
    expect(languageSwitchers).toHaveLength(3);
    for (const switcher of languageSwitchers) {
      expect(
        within(switcher).getByRole("radio", { name: "English" }),
      ).toBeInTheDocument();
    }
  });

  it("keeps Description and Long description as independent values", () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={{
          ...createEmptyBookFormValues(),
          description: { ar: "وصف قصير", en: "" },
          longDescription: { ar: "وصف طويل", en: "" },
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: { ar: "وصف قصير", en: "" },
        longDescription: { ar: "وصف طويل", en: "" },
      }),
    );
  });

  it("renders Long description as the translatable Markdown-backed editor", async () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={{
          ...createEmptyBookFormValues(),
          longDescription: { ar: "# نص", en: "# Text" },
        }}
        onSubmit={vi.fn()}
      />,
    );

    // TranslatableTextArea (Markdown) renders "# نص" as a live heading.
    expect(
      await screen.findByRole("heading", { name: "نص" }),
    ).toBeInTheDocument();
  });

  it("uses the error-variant ToggleCard for Locked and the primary-variant for Published", () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
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

    // Locked reads as high-emphasis/destructive; Published is a lower-
    // emphasis affirmative setting -- the two are expected to render with
    // different checked-state classes, not the same one.
    expect(published.className).not.toBe(locked.className);
  });

  it("submits the canonical isLocked/isPublished fields", () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Locked" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ isLocked: true, isPublished: false }),
    );
  });

  it("renders Color as an editable Autocomplete field rather than a graphical ColorInput", () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={vi.fn()}
      />,
    );

    // ColorInput exposes a swatch preview/picker button; Autocomplete is a
    // plain combobox textbox with no such button (ANA-63).
    const colorField = screen.getByRole("combobox", { name: "Color" });
    expect(colorField).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /color/i }),
    ).not.toBeInTheDocument();
  });

  it("offers named application-color suggestions and selects the exact token string", async () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={onSubmit}
      />,
    );

    const colorField = screen.getByRole("combobox", { name: "Color" });
    fireEvent.change(colorField, { target: { value: "cyan.6" } });
    fireEvent.click(await screen.findByRole("option", { name: "cyan.6" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(colorField).toHaveValue("cyan.6");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: "cyan.6" }),
    );
  });

  it("renders the 15-color swatch picker wired to the Color field (ANA-89)", () => {
    renderWithProvider(
      <BookForm
        id={FORM_ID}
        initialValues={{ ...createEmptyBookFormValues(), color: "cyan.6" }}
        onSubmit={vi.fn()}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Color" });
    expect(within(group).getAllByRole("radio")).toHaveLength(15);
    expect(within(group).getByRole("radio", { name: "Cyan" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking a swatch sets the Color field to <color>.6", () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Pink" }));

    expect(screen.getByRole("combobox", { name: "Color" })).toHaveValue(
      "pink.6",
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: "pink.6" }),
    );
  });

  it("keeps a manually-typed, free-form color value and submits it unchanged", () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={createEmptyBookFormValues()}
        onSubmit={onSubmit}
      />,
    );

    const colorField = screen.getByRole("combobox", { name: "Color" });
    fireEvent.change(colorField, { target: { value: "#1c7ed6ff" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: "#1c7ed6ff" }),
    );
  });

  it("calls onSubmit with the current field values when submitted via an external header button, and makes no network request", () => {
    const onSubmit = vi.fn();
    renderWithExternalSubmit(
      <BookForm
        id={FORM_ID}
        initialValues={{
          ...createEmptyBookFormValues(),
          imageId: "story-1",
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: "story-1" }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("toBookWritableFields", () => {
  it("normalizes translatable fields to explicit { ar, en } pairs and passes the rest through", () => {
    expect(
      toBookWritableFields({
        title: { ar: "عنوان" },
        description: {},
        longDescription: { en: "Long" },
        imageId: "book-1",
        isLocked: true,
        isPublished: false,
        color: "#1c7ed6",
      }),
    ).toEqual({
      title: { ar: "عنوان", en: "" },
      description: { ar: "", en: "" },
      longDescription: { ar: "", en: "Long" },
      imageId: "book-1",
      isLocked: true,
      isPublished: false,
      color: "#1c7ed6",
    });
  });

  it("never includes modules or audit/timestamp fields", () => {
    const fields = toBookWritableFields(createEmptyBookFormValues());

    expect(fields).not.toHaveProperty("modules");
    expect(fields).not.toHaveProperty("createdAt");
    expect(fields).not.toHaveProperty("updatedAt");
    expect(fields).not.toHaveProperty("createdBy");
    expect(fields).not.toHaveProperty("updatedBy");
  });
});
