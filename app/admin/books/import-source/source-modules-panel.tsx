"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Text } from "@mantine/core";
import { Plus } from "lucide-react";

import { SortableList } from "@/components/ui/sortable-list";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import { LearningMaterialModuleCard } from "./learning-material-module-card";
import styles from "./source-modules-panel.module.css";

const EMPTY_MATERIAL: TranslatableString = { ar: "", en: "" };

export interface SourceModulesPanelProps<T> {
  /** Every Module shown in this panel, in current display order -- either
   * flow's own item type (`TempModule`, `WorkspaceModuleEntry`), read only
   * through the accessor props below. This component never assumes a
   * particular shape beyond a stable key and a Learning Material draft, so
   * each flow keeps its own data/persistence state (ANA-79). */
  items: T[];
  getKey: (item: T) => string;
  getMaterial: (item: T) => TranslatableString;
  onMaterialChange: (key: string, material: TranslatableString) => void;
  /** Fired with the full reordered list once a drag actually changes order
   * -- forwarded straight from `SortableList`. */
  onReorder: (items: T[]) => void;
  fontScale: number;
  /** True while a Save/Finish request is persisting the snapshot this panel
   * was showing when it was submitted -- freezes every card's editor and
   * header actions, and disables Create Module. */
  disabled: boolean;
  /** True while sorting must be suspended for a reason beyond `disabled`
   * (e.g. a partial-Finish retry that can't have its temporary Module order
   * disturbed) -- see each caller for its own reason. */
  reorderDisabled: boolean;
  canCreateModule: boolean;
  onCreateModule: () => void;
  onDeleteItem: (key: string) => Promise<void> | void;
  /** The delete confirmation dialog's description for a given item --
   * return `undefined` to use `LearningMaterialModuleCard`'s persisted-
   * Module default copy. */
  getDeleteConfirmDescription?: (key: string) => string | undefined;
  isDeleteDisabled: (key: string) => boolean;
  onTranslateItem: (key: string, basePrompt: string) => Promise<void>;
  /** AI Assistant for a given item (ANA-85, PR review), keyed by `getKey` --
   * called with the active language tab (owned by the card itself), the
   * optional trimmed instructions, and the exact selected Markdown the
   * card captured. Resolves to the replacement text; the card itself
   * applies it in place (restoring its own captured Lexical selection and
   * replacing exactly that range) -- this callback never touches the
   * item's `material` itself. */
  onAiAssistItem: (
    key: string,
    language: "ar" | "en",
    instructions: string | undefined,
    selectedMarkdown: string,
    basePrompt: string,
  ) => Promise<string>;
}

function SortableModuleCard<T>({
  item,
  dragId,
  index,
  getMaterial,
  onMaterialChange,
  fontScale,
  disabled,
  reorderDisabled,
  onDelete,
  deleteConfirmDescription,
  deleteDisabled,
  onTranslate,
  onAiAssist,
  testId,
}: {
  item: T;
  /** The id `SortableList`'s own `SortableContext` was given for this item
   * (via `getKey`) -- must match exactly, or dnd-kit can't resolve this
   * row's drag/drop target at all. Kept distinct from `testId`, which is
   * only a DOM test hook and may carry an unrelated prefix. */
  dragId: string;
  index: number;
  getMaterial: (item: T) => TranslatableString;
  onMaterialChange: (value: TranslatableString) => void;
  fontScale: number;
  disabled: boolean;
  reorderDisabled: boolean;
  onDelete: () => Promise<void> | void;
  deleteConfirmDescription: string | undefined;
  deleteDisabled: boolean;
  onTranslate: (basePrompt: string) => Promise<void>;
  onAiAssist: (
    language: "ar" | "en",
    instructions: string | undefined,
    selectedMarkdown: string,
    basePrompt: string,
  ) => Promise<string>;
  testId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId, disabled: reorderDisabled });

  return (
    <LearningMaterialModuleCard
      testId={testId}
      index={index}
      material={getMaterial(item)}
      onMaterialChange={onMaterialChange}
      fontScale={fontScale}
      disabled={disabled}
      drag={
        reorderDisabled
          ? undefined
          : {
              attributes,
              listeners,
              setNodeRef,
              style: {
                transform: CSS.Transform.toString(transform),
                transition,
              },
              isDragging,
            }
      }
      onDelete={onDelete}
      deleteConfirmDescription={deleteConfirmDescription}
      deleteDisabled={deleteDisabled}
      onTranslate={onTranslate}
      onAiAssist={onAiAssist}
    />
  );
}

// The single Source Modules panel shared by Create-from-PDF
// (module-builder-view.tsx) and View Source Text (saved-source-view.tsx) --
// ANA-79, replacing two independently-implemented Modules lists that had
// drifted apart (one sortable with no card gap, the other spaced but not
// sortable). Owns every Module-list-level concern: header/title/count,
// Create Module, empty state, `SortableList`/drag-and-drop wiring, card
// spacing, `LearningMaterialModuleCard` rendering, and the drag overlay --
// changing any of these here changes both flows at once. Each flow keeps its
// own data shape and persistence/retry state, supplied through the accessor
// and callback props rather than a shared item type.
export function SourceModulesPanel<T>({
  items,
  getKey,
  getMaterial,
  onMaterialChange,
  onReorder,
  fontScale,
  disabled,
  reorderDisabled,
  canCreateModule,
  onCreateModule,
  onDeleteItem,
  getDeleteConfirmDescription,
  isDeleteDisabled,
  onTranslateItem,
  onAiAssistItem,
}: SourceModulesPanelProps<T>) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Text size="sm" fw={500}>
          Modules{items.length > 0 ? ` (${items.length})` : ""}
        </Text>
        <Button
          size="xs"
          leftSection={<Plus size={14} aria-hidden="true" />}
          disabled={!canCreateModule || disabled}
          // Clicking a button starts with a mousedown, whose default
          // browser behavior both collapses the current text selection and
          // shifts focus away from the source text -- either one alone
          // clears the caller's selection before this button's own onClick
          // can run. Preventing that default keeps the selection (and
          // focus) intact through the click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCreateModule}
        >
          Create Module
        </Button>
      </div>
      <div className={styles.panelBody}>
        {items.length === 0 ? (
          <p className={styles.emptyState}>
            Select text on the left and click &ldquo;Create Module&rdquo; to get
            started.
          </p>
        ) : (
          <SortableList<T>
            items={items}
            getId={getKey}
            onReorder={onReorder}
            className={styles.list}
            renderItem={(item, index) => {
              const key = getKey(item);

              return (
                <SortableModuleCard<T>
                  key={key}
                  item={item}
                  dragId={key}
                  index={index}
                  getMaterial={getMaterial}
                  onMaterialChange={(value) => onMaterialChange(key, value)}
                  fontScale={fontScale}
                  disabled={disabled}
                  reorderDisabled={reorderDisabled}
                  onDelete={() => onDeleteItem(key)}
                  deleteConfirmDescription={getDeleteConfirmDescription?.(key)}
                  deleteDisabled={isDeleteDisabled(key)}
                  onTranslate={(basePrompt) => onTranslateItem(key, basePrompt)}
                  onAiAssist={(
                    language,
                    instructions,
                    selectedMarkdown,
                    basePrompt,
                  ) =>
                    onAiAssistItem(
                      key,
                      language,
                      instructions,
                      selectedMarkdown,
                      basePrompt,
                    )
                  }
                  testId={`module-card-${key}`}
                />
              );
            }}
            renderOverlay={(item, index, width) => (
              <LearningMaterialModuleCard
                testId={`module-card-overlay-${getKey(item)}`}
                index={index}
                material={getMaterial(item) ?? EMPTY_MATERIAL}
                onMaterialChange={() => {}}
                fontScale={fontScale}
                disabled
                // Always collapsed and never interactive (ANA-80) -- this
                // is a fresh mount on every drag, so without forcing it
                // collapsed here it would fall back to its own default
                // `expanded: true` and show the Markdown editor mid-drag
                // regardless of whether the real card being dragged was
                // collapsed. `onDelete`/`onTranslate` are wired (as
                // no-ops, already inert via `disabled`) purely so the
                // preview reserves the exact same header layout as every
                // real row -- `SourceModulesPanel` always wires both.
                forceCollapsed
                onDelete={() => {}}
                onTranslate={async () => {}}
                onAiAssist={async () => ""}
                style={{
                  pointerEvents: "none",
                  ...(width != null ? { width } : {}),
                }}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
