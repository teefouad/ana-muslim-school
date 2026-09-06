import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { PdfFilePicker } from "./pdf-file-picker";

function renderPicker(onFileSelected = vi.fn()) {
  render(
    <MantineProvider>
      <PdfFilePicker onFileSelected={onFileSelected} />
    </MantineProvider>,
  );
  return onFileSelected;
}

function pdfFile(name = "document.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

describe("PdfFilePicker", () => {
  it("shows the drop zone copy", () => {
    renderPicker();

    expect(screen.getByText("Choose a PDF to import")).toBeInTheDocument();
    expect(
      screen.getByText("Click to browse or drag and drop a file here"),
    ).toBeInTheDocument();
  });

  it("opens the native file picker on click", () => {
    renderPicker();
    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(
      screen.getByRole("button", { name: "Choose a PDF to import" }),
    );

    expect(clickSpy).toHaveBeenCalled();
  });

  it.each(["Enter", " "])("opens the native file picker on %s", (key) => {
    renderPicker();
    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Choose a PDF to import" }),
      { key },
    );

    expect(clickSpy).toHaveBeenCalled();
  });

  it("selects a valid PDF via the file input", () => {
    const onFileSelected = renderPicker();
    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const file = pdfFile();

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("selects a valid PDF via drag and drop", () => {
    const onFileSelected = renderPicker();
    const dropzone = screen.getByRole("button", {
      name: "Choose a PDF to import",
    });
    const file = pdfFile();

    fireEvent.dragOver(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("rejects a non-PDF file with a user-facing error, without calling onFileSelected", () => {
    const onFileSelected = renderPicker();
    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const file = new File(["hi"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please choose a PDF file.",
    );
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("allows reselecting the same file after a retry", () => {
    const onFileSelected = renderPicker();
    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const file = pdfFile();

    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledTimes(2);
  });
});
