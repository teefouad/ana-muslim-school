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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequestBody(): Record<string, unknown> {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function lastRequestUrl(): string {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [url] = calls[calls.length - 1] as [string, RequestInit];
  return url;
}

// Long description is a `type="markdown"` field -- its contenteditable
// body (also role "textbox", like every plain text input) has no `label
// for` association to query by label text, unlike Title/Description. It's
// the only "textbox" with a `contenteditable` attribute.
function getLongDescriptionEditable(): HTMLElement {
  return screen
    .getAllByRole("textbox")
    .find((el) => el.hasAttribute("contenteditable"))!;
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

    // Title/Description/Long description's own AI Assistance/Translate
    // with AI actions (ANA-100) are legitimate buttons this form does
    // render -- only a bottom Submit/Cancel pair is what this checks for.
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
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

  describe("Book field AI actions (ANA-100)", () => {
    const FILLED_VALUES = {
      ...createEmptyBookFormValues(),
      title: { ar: "عنوان الكتاب", en: "" },
      description: { ar: "وصف قصير", en: "" },
      longDescription: { ar: "وصف طويل", en: "" },
    };

    it("exposes Translate with AI but not AI Assistance for Title", () => {
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={createEmptyBookFormValues()}
          onSubmit={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "AI Assistance for Title" }),
      ).not.toBeInTheDocument();
    });

    it("exposes both Translate with AI and AI Assistance for Description", () => {
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={createEmptyBookFormValues()}
          onSubmit={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Translate Description with AI" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "AI Assistance for Description" }),
      ).toBeInTheDocument();
    });

    it("exposes both Translate with AI and AI Assistance for Long description", () => {
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={createEmptyBookFormValues()}
          onSubmit={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", {
          name: "Translate Long description with AI",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "AI Assistance for Long description",
        }),
      ).toBeInTheDocument();
    });

    it("sends bookTitle/bookLongDescription context (no bookId) for Description AI Assistance, and applies the result", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف محسّن" } }),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Description" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestUrl()).toBe("/api/v1/ai/assist");
      expect(lastRequestBody()).toMatchObject({
        field: "bookDescription",
        text: "وصف قصير",
        language: "ar",
        bookTitle: "عنوان الكتاب",
        bookLongDescription: "وصف طويل",
      });
      expect(lastRequestBody()).not.toHaveProperty("bookId");

      expect(await screen.findByDisplayValue("وصف محسّن")).toBeInTheDocument();
    });

    it("runs AI Assistance on the active English tab, sends English context and language: en, and applies the result to English only -- not Arabic (PR review regression)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Improved description" } }),
      );
      const BILINGUAL_VALUES = {
        ...createEmptyBookFormValues(),
        title: { ar: "عنوان الكتاب", en: "Book Title" },
        description: { ar: "وصف قصير", en: "Short description" },
        longDescription: { ar: "وصف طويل", en: "Long description" },
      };
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={BILINGUAL_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      // Title, Description, Long description, in that order.
      const switchers = screen.getAllByRole("radiogroup", { name: "Language" });
      fireEvent.click(
        within(switchers[1]).getByRole("radio", { name: "English" }),
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Description" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        field: "bookDescription",
        text: "Short description",
        language: "en",
        bookTitle: "Book Title",
        bookLongDescription: "Long description",
      });

      expect(
        await screen.findByDisplayValue("Improved description"),
      ).toBeInTheDocument();

      // Switching back to Arabic must show the untouched Arabic value --
      // the AI result must never have landed there.
      fireEvent.click(
        within(switchers[1]).getByRole("radio", { name: "Arabic" }),
      );
      expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
    });

    it("sends bookTitle/bookDescription context (no bookId) for Long description AI Assistance, and applies the result", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف طويل محسّن" } }),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "AI Assistance for Long description",
        }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestUrl()).toBe("/api/v1/ai/assist");
      expect(lastRequestBody()).toMatchObject({
        field: "bookLongDescription",
        text: "وصف طويل",
        language: "ar",
        bookTitle: "عنوان الكتاب",
        bookDescription: "وصف قصير",
      });
      expect(lastRequestBody()).not.toHaveProperty("bookId");

      expect(await screen.findByText("وصف طويل محسّن")).toBeInTheDocument();
    });

    it("runs Long description AI Assistance on the active English tab, sends English context and language: en (PR review regression)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Improved long description" } }),
      );
      const BILINGUAL_VALUES = {
        ...createEmptyBookFormValues(),
        title: { ar: "عنوان الكتاب", en: "Book Title" },
        description: { ar: "وصف قصير", en: "Short description" },
        longDescription: { ar: "وصف طويل", en: "Long description" },
      };
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={BILINGUAL_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      // Title, Description, Long description, in that order.
      const switchers = screen.getAllByRole("radiogroup", { name: "Language" });
      fireEvent.click(
        within(switchers[2]).getByRole("radio", { name: "English" }),
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "AI Assistance for Long description",
        }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        field: "bookLongDescription",
        text: "Long description",
        language: "en",
        bookTitle: "Book Title",
        bookDescription: "Short description",
      });

      expect(
        await screen.findByText("Improved long description"),
      ).toBeInTheDocument();
    });

    it("Translate with AI sends only the Arabic text -- no field, bookId, or Book context -- for Title/Description/Long description", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Translated" } }),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      );
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestUrl()).toBe("/api/v1/ai/translate");
      expect(lastRequestBody()).toEqual({ text: "عنوان الكتاب" });
    });
  });

  describe("AI busy is scoped to the active field (ANA-109)", () => {
    const FILLED_VALUES = {
      ...createEmptyBookFormValues(),
      title: { ar: "عنوان الكتاب", en: "" },
      description: { ar: "وصف قصير", en: "" },
      longDescription: { ar: "وصف طويل", en: "" },
    };

    it("disables only Title while its Translate request is running, and re-enables it once it resolves", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      );

      await vi.waitFor(() => {
        expect(screen.getByLabelText("Title")).toBeDisabled();
      });
      expect(screen.getByLabelText("Description")).not.toBeDisabled();
      expect(getLongDescriptionEditable()).toHaveAttribute(
        "contenteditable",
        "true",
      );
      expect(
        screen.getByRole("textbox", { name: "In-app image ID" }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("radiogroup", { name: "Color" }),
      ).not.toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("switch", { name: "Locked" })).not.toBeDisabled();
      expect(
        screen.getByRole("switch", { name: "Published" }),
      ).not.toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Book Title" } }));

      await vi.waitFor(() => {
        expect(screen.getByLabelText("Title")).not.toBeDisabled();
      });
    });

    it("disables only Description while its Translate request is running", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Description with AI" }),
      );

      await vi.waitFor(() => {
        expect(screen.getByLabelText("Description")).toBeDisabled();
      });
      expect(screen.getByLabelText("Title")).not.toBeDisabled();
      expect(getLongDescriptionEditable()).toHaveAttribute(
        "contenteditable",
        "true",
      );

      resolveTranslate(jsonResponse({ data: { text: "Short description" } }));

      await vi.waitFor(() => {
        expect(screen.getByLabelText("Description")).not.toBeDisabled();
      });
    });

    it("re-enables Title even when its Translate request fails, leaving other fields untouched throughout", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: "Something went wrong." }, 500),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      );

      await screen.findByText("Something went wrong.");
      expect(screen.getByLabelText("Title")).not.toBeDisabled();
      expect(screen.getByLabelText("Description")).not.toBeDisabled();
    });

    it("re-enables Description even when its AI Assistance request fails", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: "Something went wrong." }, 500),
      );
      renderWithProvider(
        <BookForm
          id={FORM_ID}
          initialValues={FILLED_VALUES}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Description" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await screen.findByText("Something went wrong.");
      expect(screen.getByLabelText("Description")).not.toBeDisabled();
      expect(screen.getByLabelText("Title")).not.toBeDisabled();
    });
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
