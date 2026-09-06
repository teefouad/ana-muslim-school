"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Group, Text } from "@mantine/core";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule, TextDirection } from "./import-source-types";
import { FontSizeControl } from "./font-size-control";
import { ModuleList } from "./module-list";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./module-builder-view.module.css";

export interface ModuleBuilderViewProps {
  fileName: string;
  ocrResult: OcrResult;
  editedMarkdown: Record<number, string>;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
  modules: TempModule[];
  onModulesChange: (modules: TempModule[]) => void;
  onBack: () => void;
}

// Step 4, the final functional screen in the Import Source modal (ANA-68).
// No pdf.js dependency here (unlike PdfViewer/OcrResultView) -- the source
// text is already extracted -- so this needs no next/dynamic({ssr:false})
// wrapper.
export function ModuleBuilderView({
  fileName,
  ocrResult,
  editedMarkdown,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
  modules,
  onModulesChange,
  onBack,
}: ModuleBuilderViewProps) {
  const sourceRef = useRef<HTMLPreElement>(null);
  const [selectedText, setSelectedText] = useState("");

  const joinedText = ocrResult.pages
    .map((page) => editedMarkdown[page.pageNumber] ?? page.markdown)
    .join("\n\n");

  useEffect(() => {
    function handleSelectionChange() {
      const source = sourceRef.current;
      const selection = document.getSelection();

      if (
        !source ||
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !source.contains(selection.getRangeAt(0).commonAncestorContainer)
      ) {
        setSelectedText("");
        return;
      }

      setSelectedText(selection.toString());
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function handleSourceBlur(event: React.FocusEvent<HTMLPreElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setSelectedText("");
    }
  }

  const canCreateModule = selectedText.trim().length > 0;

  function handleCreateModule() {
    if (!canCreateModule) {
      return;
    }

    onModulesChange([
      ...modules,
      { id: crypto.randomUUID(), text: selectedText },
    ]);
    document.getSelection()?.removeAllRanges();
    setSelectedText("");
  }

  return (
    <div className={styles.shell}>
      <div className={styles.summaryHeader}>
        <Text size="sm" fw={500}>
          {fileName}
        </Text>
        <Group gap="sm">
          <FontSizeControl value={fontScale} onChange={onFontScaleChange} />
          <TextDirectionControl
            value={direction}
            onChange={onDirectionChange}
          />
        </Group>
      </div>

      <div className={styles.body}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Text size="sm" fw={500}>
              Extracted text
            </Text>
          </div>
          <div className={styles.panelBody}>
            <pre
              ref={sourceRef}
              tabIndex={0}
              dir={direction}
              className={styles.sourceText}
              style={{ fontSize: `${14 * (fontScale / 100)}px` }}
              onBlur={handleSourceBlur}
            >
              {joinedText || (
                <span className={styles.placeholder}>
                  No text was extracted from this document.
                </span>
              )}
            </pre>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Text size="sm" fw={500}>
              Modules{modules.length > 0 ? ` (${modules.length})` : ""}
            </Text>
            <Button
              size="xs"
              leftSection={<Plus size={14} aria-hidden="true" />}
              disabled={!canCreateModule}
              onClick={handleCreateModule}
            >
              Create Module
            </Button>
          </div>
          <div className={styles.panelBody}>
            {modules.length === 0 ? (
              <p className={styles.emptyState}>
                Select text on the left and click &ldquo;Create Module&rdquo; to
                get started.
              </p>
            ) : (
              <ModuleList modules={modules} onModulesChange={onModulesChange} />
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <Button
          variant="default"
          leftSection={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          rightSection={<ArrowRight size={16} aria-hidden="true" />}
          disabled={modules.length === 0}
          // Intentionally no onClick -- Create Learning Material is present
          // per ANA-68 but must perform no action in this card. Generation/
          // persistence is explicitly follow-up work.
        >
          Create Learning Material
        </Button>
      </div>
    </div>
  );
}
