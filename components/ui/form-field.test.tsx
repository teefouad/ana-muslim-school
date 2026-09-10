import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormField } from "./form-field";
import type { TranslatedValue } from "./translatable-value";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("FormField", () => {
  describe("field types", () => {
    it("renders a plain text field and reports plain string changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <FormField label="Title" value="Hello" onChange={onChange} />,
      );

      const input = screen.getByLabelText("Title");
      expect(input).toHaveValue("Hello");

      fireEvent.change(input, { target: { value: "Hello there" } });
      expect(onChange).toHaveBeenCalledWith("Hello there");
    });

    it("renders a plain textarea field", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <FormField
          label="Description"
          type="textarea"
          value="Some text"
          onChange={onChange}
        />,
      );

      const textarea = screen.getByLabelText("Description");
      expect(textarea.tagName).toBe("TEXTAREA");
      expect(textarea).toHaveValue("Some text");

      fireEvent.change(textarea, { target: { value: "More text" } });
      expect(onChange).toHaveBeenCalledWith("More text");
    });

    it("renders a markdown field", async () => {
      const onChange = vi.fn();
      renderWithProvider(
        <FormField
          label="Content"
          type="markdown"
          value="# Heading"
          onChange={onChange}
        />,
      );

      expect(
        await screen.findByRole("heading", { name: "Heading" }),
      ).toBeInTheDocument();
    });
  });

  describe("translatable / language switching", () => {
    it("defaults to Arabic and preserves both values when switching languages", () => {
      const onChange = vi.fn();
      const value: TranslatedValue = { ar: "عنوان", en: "Title" };

      renderWithProvider(
        <FormField
          label="Title"
          translatable
          value={value}
          onChange={onChange}
        />,
      );

      expect(screen.getByLabelText("Title")).toHaveValue("عنوان");

      fireEvent.click(screen.getByRole("radio", { name: "English" }));
      expect(screen.getByLabelText("Title")).toHaveValue("Title");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("editing the active language preserves the other language's value", () => {
      const onChange = vi.fn();
      const value: TranslatedValue = { ar: "عنوان", en: "Title" };

      renderWithProvider(
        <FormField
          label="Title"
          translatable
          value={value}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });

      expect(onChange).toHaveBeenCalledWith({ ar: "عنوان جديد", en: "Title" });
    });

    it("does not show a language switcher when not translatable", () => {
      renderWithProvider(
        <FormField label="Title" value="" onChange={vi.fn()} />,
      );

      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });

  describe("optional AI actions", () => {
    it("hides AI Assistance and Translate with AI by default", () => {
      renderWithProvider(
        <FormField
          label="Title"
          translatable
          value={{ ar: "عنوان" }}
          onChange={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /AI Assistance/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Translate/ }),
      ).not.toBeInTheDocument();
    });

    it("shows AI Assistance for a non-translatable field", () => {
      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
    });

    it("disables AI Assistance when the field is empty", () => {
      renderWithProvider(
        <FormField
          label="Title"
          value=""
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeDisabled();
    });
  });

  describe("AI Assistance flow (Additional Instructions)", () => {
    it("invokes the context builder and calls onAiAssist with the field's text, language, and trimmed instructions", async () => {
      const onChange = vi.fn();
      const getContext = vi.fn().mockReturnValue({ bookId: "book-1" });
      const { promise, resolve } = deferred<string>();
      const onAiAssist = vi.fn().mockReturnValue(promise);

      renderWithProvider(
        <FormField
          label="Description"
          translatable
          value={{ ar: "وصف" }}
          onChange={onChange}
          aiAssistance
          onAiAssist={onAiAssist}
          getAIAssistanceContext={getContext}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Description" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.change(
        within(dialog).getByLabelText(
          "Additional instructions or context (optional)",
        ),
        { target: { value: "Make it shorter" } },
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      expect(getContext).toHaveBeenCalledTimes(1);
      expect(onAiAssist).toHaveBeenCalledWith({
        text: "وصف",
        language: "ar",
        instructions: "Make it shorter",
        context: { bookId: "book-1" },
      });

      resolve("وصف أقصر");

      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ ar: "وصف أقصر" }),
      );
    });

    it("passes undefined instructions when the Additional Instructions field is left blank", async () => {
      const onAiAssist = vi.fn().mockResolvedValue("refined");

      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={onAiAssist}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      expect(onAiAssist).toHaveBeenCalledWith(
        expect.objectContaining({ instructions: undefined }),
      );
    });
  });

  describe("Translate with AI flow", () => {
    it("translates immediately when English is empty", async () => {
      const onChange = vi.fn();
      const getContext = vi.fn().mockReturnValue({ bookId: "book-1" });
      const onAiTranslate = vi.fn().mockResolvedValue("Description");

      renderWithProvider(
        <FormField
          label="Description"
          translatable
          value={{ ar: "وصف", en: "" }}
          onChange={onChange}
          aiTranslation
          onAiTranslate={onAiTranslate}
          getAITranslationContext={getContext}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Description with AI" }),
      );

      expect(getContext).toHaveBeenCalledTimes(1);
      await vi.waitFor(() =>
        expect(onAiTranslate).toHaveBeenCalledWith({
          text: "وصف",
          language: "ar",
          context: { bookId: "book-1" },
        }),
      );
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ ar: "وصف", en: "Description" }),
      );
    });

    it("confirms before overwriting a non-empty English value", async () => {
      const onChange = vi.fn();
      const onAiTranslate = vi.fn().mockResolvedValue("New description");

      renderWithProvider(
        <FormField
          label="Description"
          translatable
          value={{ ar: "وصف", en: "Old description" }}
          onChange={onChange}
          aiTranslation
          onAiTranslate={onAiTranslate}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Description with AI" }),
      );

      expect(onAiTranslate).not.toHaveBeenCalled();
      const confirmDialog = await screen.findByRole("dialog", {
        name: "Replace English translation?",
      });
      fireEvent.click(
        within(confirmDialog).getByRole("button", {
          name: "Translate and replace",
        }),
      );

      await vi.waitFor(() => expect(onAiTranslate).toHaveBeenCalled());
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          ar: "وصف",
          en: "New description",
        }),
      );
    });

    it("does not translate when cancelling the overwrite confirmation", async () => {
      const onAiTranslate = vi.fn().mockResolvedValue("New description");

      renderWithProvider(
        <FormField
          label="Description"
          translatable
          value={{ ar: "وصف", en: "Old description" }}
          onChange={vi.fn()}
          aiTranslation
          onAiTranslate={onAiTranslate}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Description with AI" }),
      );
      const confirmDialog = await screen.findByRole("dialog", {
        name: "Replace English translation?",
      });
      fireEvent.click(
        within(confirmDialog).getByRole("button", { name: "Cancel" }),
      );

      expect(onAiTranslate).not.toHaveBeenCalled();
    });
  });

  describe("loading/disabled behavior", () => {
    it("disables the field's own input and action while its AI request is in flight, then re-enables it", async () => {
      const { promise, resolve } = deferred<string>();
      const onAiAssist = vi.fn().mockReturnValue(promise);

      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={onAiAssist}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() =>
        expect(screen.getByLabelText("Title")).toBeDisabled(),
      );

      resolve("Refined text");

      await vi.waitFor(() =>
        expect(screen.getByLabelText("Title")).not.toBeDisabled(),
      );
    });

    it("reports busy state through onBusyChange", async () => {
      const { promise, resolve } = deferred<string>();
      const onAiAssist = vi.fn().mockReturnValue(promise);
      const onBusyChange = vi.fn();

      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={onAiAssist}
          onBusyChange={onBusyChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true));

      resolve("Refined text");

      await vi.waitFor(() =>
        expect(onBusyChange).toHaveBeenLastCalledWith(false),
      );
    });

    it("disables the field entirely via the disabled prop", () => {
      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          disabled
          aiAssistance
          onAiAssist={vi.fn()}
        />,
      );

      expect(screen.getByLabelText("Title")).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeDisabled();
    });
  });

  describe("failure recovery", () => {
    it("shows an error and re-enables the field when AI Assistance fails, allowing a retry", async () => {
      const onAiAssist = vi
        .fn()
        .mockRejectedValueOnce(new Error("Something went wrong."))
        .mockResolvedValueOnce("Refined text");

      renderWithProvider(
        <FormField
          label="Title"
          value="Some text"
          onChange={vi.fn()}
          aiAssistance
          onAiAssist={onAiAssist}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      let dialog = await screen.findByRole("dialog", { name: "AI Assistance" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      expect(
        await screen.findByText("Something went wrong."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      dialog = await screen.findByRole("dialog", { name: "AI Assistance" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(onAiAssist).toHaveBeenCalledTimes(2));
      expect(
        screen.queryByText("Something went wrong."),
      ).not.toBeInTheDocument();
    });

    it("re-enables the field when Translate with AI fails", async () => {
      const onAiTranslate = vi
        .fn()
        .mockRejectedValue(new Error("Translation failed."));

      renderWithProvider(
        <FormField
          label="Title"
          translatable
          value={{ ar: "عنوان", en: "" }}
          onChange={vi.fn()}
          aiTranslation
          onAiTranslate={onAiTranslate}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      );

      expect(
        await screen.findByText("Translation failed."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).not.toBeDisabled();
    });
  });

  describe("controlled usage", () => {
    it("round-trips through a stateful parent", async () => {
      function Harness() {
        const [value, setValue] = useState("Hello");
        return <FormField label="Title" value={value} onChange={setValue} />;
      }

      renderWithProvider(<Harness />);

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Hello world" },
      });

      expect(screen.getByLabelText("Title")).toHaveValue("Hello world");
    });
  });
});
