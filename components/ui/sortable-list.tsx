"use client";

import { type ReactNode, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// A plain click (pointer down+up with no real movement) must not start a
// drag -- dnd-kit only activates a pointer drag once the pointer has moved
// this far. One shared value so every reorderable list in the app feels
// identical, instead of each list picking its own constant.
const DRAG_ACTIVATION_DISTANCE_PX = 6;

export interface SortableListProps<T> {
  /** The list to render, in its current order. */
  items: T[];
  /** A stable, unique id for each item -- what dnd-kit tracks drag/drop
   * targets by. Must match whatever id each row passes to its own
   * `useSortable({ id })` call (see `renderItem`). */
  getId: (item: T) => string;
  /** Fired with the full reordered array once a drag actually changes the
   * order (never for a drop back onto the same position). The caller
   * decides what happens next -- this component has no opinion on
   * persistence. */
  onReorder: (items: T[]) => void;
  /** One row. Must return a single top-level element carrying its own
   * `key={getId(item)}` and its own `useSortable({ id: getId(item) })` call
   * for the row's drag ref/transform/isDragging wiring -- SortableList only
   * supplies the surrounding DndContext/SortableContext/sensors, not each
   * row's own drag plumbing, since every row's visual structure differs too
   * much to generalize further. */
  renderItem: (item: T, index: number) => ReactNode;
  /** The floating preview shown under the cursor/touch point while
   * dragging, portaled outside the scrolling list via dnd-kit's
   * DragOverlay so it isn't clipped by an `overflow` container. `width` is
   * the dragged row's own measured width at the moment the drag started
   * (`null` if dnd-kit couldn't measure it) -- a portaled overlay has no
   * container of its own to inherit a width from, so without this it
   * stretches to fill `document.body` instead of matching the resting row
   * (ANA-80). Pass it through as an explicit inline `width` on the
   * overlay's root so its layout can't drift from the idle row's. */
  renderOverlay: (item: T, index: number, width: number | null) => ReactNode;
  className?: string;
}

// Reads the active row's own measured width reactively from `DndContext`
// (rather than a snapshot taken in `onDragStart`) and passes it through to
// `renderOverlay`. `activeNodeRect` is populated by dnd-kit's own layout
// effect once it has actually measured the dragged node, which runs *after*
// `onDragStart` fires -- capturing `event.active.rect.current.initial`
// inside that callback instead would always read the ref's unmeasured
// `null` starting value (confirmed against `@dnd-kit/core`'s own source:
// `DragOverlay` reads this same reactive value for its own positioning,
// rather than the `onDragStart` event, for the same reason). Rendered
// inside `DragOverlay`'s own children, which -- and thus this component
// too -- are already descendants of the `DndContext` this hook reads.
function OverlayContent<T>({
  item,
  index,
  renderOverlay,
}: {
  item: T;
  index: number;
  renderOverlay: SortableListProps<T>["renderOverlay"];
}) {
  const { activeNodeRect } = useDndContext();
  return <>{renderOverlay(item, index, activeNodeRect?.width ?? null)}</>;
}

// The shared drag-sensor/DndContext/SortableContext/DragOverlay wiring for
// every reorderable list in the app. Extracted so a future change to drag
// activation distance, keyboard coordinate handling, or collision detection
// lands once for every list at once, and so every new sortable list starts
// from the same primitive rather than another copy-paste.
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  renderOverlay,
  className,
}: SortableListProps<T>) {
  // dnd-kit's own default id (used to build its aria-describedby ids, e.g.
  // "DndDescribedBy-0") comes from a module-level render-order counter, not
  // React's SSR-safe useId() -- server and client render passes can walk
  // that counter differently (most visibly with more than one SortableList
  // on a page), producing a hydration mismatch on that attribute. useId()
  // is deterministic between server/client and unique per instance, so it
  // also keeps multiple concurrent lists from colliding.
  const dndContextId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = items.map(getId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  const activeIndex = activeId
    ? items.findIndex((item) => getId(item) === activeId)
    : -1;

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={items.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={className}>
          {items.map((item, index) => renderItem(item, index))}
        </ul>
      </SortableContext>
      {
        // `@dnd-kit/core`'s DragOverlay positions itself with plain
        // `position: fixed` -- it does not portal to `document.body` on its
        // own. `position: fixed` resolves against the nearest ancestor with
        // a `transform` (or `filter`/`perspective`/`will-change: transform`)
        // instead of the viewport, per the CSS containing-block spec. A
        // Mantine `Modal`'s content element carries exactly that (a
        // permanent `transform: translateY(0px)`, even once the open
        // animation settles), so a SortableList used inside a Modal (e.g.
        // the Import Source workflow's Module builder, ANA-68) rendered a
        // dragged item offset from the cursor by however far the modal
        // itself sits from the viewport's top-left corner -- confirmed by
        // reproducing the exact CSS locally with Playwright. Portaling
        // DragOverlay to `document.body` sidesteps any such ancestor
        // entirely; React context (DndContext here) still crosses portal
        // boundaries normally, so this doesn't change anything else about
        // how DragOverlay behaves. Guarded for SSR, where `document` isn't
        // defined yet -- harmless, since a drag can only ever start after
        // client-side hydration anyway.
        typeof document !== "undefined" &&
          createPortal(
            <DragOverlay>
              {activeIndex !== -1 ? (
                <OverlayContent
                  item={items[activeIndex]}
                  index={activeIndex}
                  renderOverlay={renderOverlay}
                />
              ) : null}
            </DragOverlay>,
            document.body,
          )
      }
    </DndContext>
  );
}
