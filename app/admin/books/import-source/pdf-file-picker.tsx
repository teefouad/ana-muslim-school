"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Alert } from "@mantine/core";
import { Upload } from "lucide-react";

import styles from "./pdf-file-picker.module.css";

const PDF_MIME_TYPE = "application/pdf";

export interface PdfFilePickerProps {
  onFileSelected: (file: File) => void;
  className?: string;
}

// Step 1 of the Import Source modal (ANA-68): one large interactive PDF
// drop zone filling the modal workspace. Deliberately a bespoke control
// rather than a generic upload framework -- this is the only place in the
// app that accepts a file today.
export function PdfFilePicker({
  onFileSelected,
  className,
}: PdfFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined | null) {
    if (!file) {
      return;
    }

    if (file.type !== PDF_MIME_TYPE) {
      setError("Please choose a PDF file.");
      return;
    }

    setError(null);
    onFileSelected(file);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    // Reset the input's value so selecting the same file again still fires
    // a change event (otherwise a second pick of the identical file/path
    // would be silently ignored by the browser).
    event.target.value = "";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose a PDF to import"
      className={[
        styles.dropzone,
        isDragOver && styles.dropzoneDragOver,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={openFilePicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.iconContainer}>
        <Upload size={24} aria-hidden="true" />
      </div>
      <p className={styles.title}>Choose a PDF to import</p>
      <p className={styles.subtitle}>
        Click to browse or drag and drop a file here
      </p>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        data-testid="pdf-file-input"
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />
    </div>
  );
}
