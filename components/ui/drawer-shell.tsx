"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Drawer, Group, Title } from "@mantine/core";
import { ArrowLeft } from "lucide-react";

import { ActionIconButton } from "./action-icon-button";
import styles from "./drawer-shell.module.css";

const DrawerFooterTargetContext = createContext<HTMLDivElement | null>(null);

/** Portals `children` into the nearest ancestor `DrawerShell`'s footer
 * region (ANA-122). Lets a component nested arbitrarily deep inside a
 * `DrawerShell`'s scrollable content -- e.g. `ModuleEditorBody`, which owns
 * the Cancel/Save actions' own busy/dirty state -- render its actions into
 * the drawer's fixed footer without lifting that state up into the
 * container that renders `DrawerShell` itself (see edit-module-drawer.tsx/
 * module-editor-body.tsx's `isNarrow` footer wiring). Renders nothing
 * outside a `DrawerShell` (the context default is `null`); every current
 * consumer only ever renders this inside one. */
export function DrawerFooter({ children }: { children: ReactNode }) {
  const target = useContext(DrawerFooterTargetContext);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}

export interface DrawerShellProps {
  /** Whether the drawer (and its overlay) is visible. */
  opened: boolean;
  /** Rendered in the header, next to the back button, using the same
   * `Title order={2}` typography/theme behavior as the Edit Book page
   * title (ANA-122) -- reused directly rather than approximated with a
   * custom font size/weight. */
  title: ReactNode;
  /** Every dismissal path this drawer doesn't render its own control for
   * (Escape, outside/backdrop click) funnels through this -- the same
   * guarded handler a consumer already wires its own Cancel action to, so
   * an unsaved-changes confirmation stays authoritative regardless of how
   * the drawer was dismissed. Mantine's own close/X button is never
   * rendered: this component is built from Mantine's compound `Drawer.
   * Root`/`Content`/`Header` API rather than the `<Drawer>` shorthand,
   * specifically so no `Drawer.CloseButton` is ever mounted. */
  onClose: () => void;
  /** The back arrow's own handler, for when it needs to do something other
   * than dismiss this drawer entirely -- e.g. a future child drawer
   * stacked above a parent (see `stackId` below), where the back arrow
   * should reveal the parent instead of closing the whole stack. Defaults
   * to `onClose`, matching every current consumer: a single, top-level
   * drawer where the back arrow is simply its guarded dismiss action. */
  onBack?: () => void;
  /** Scrollable content. Only this region scrolls -- the header and footer
   * stay fixed in place via a real flex-column layout (see drawer-shell.
   * module.css), never fixed pixel positioning. */
  children: ReactNode;
  /** Rendered in a footer pinned to the bottom, e.g. Cancel/Save actions.
   * Omit for a drawer with no footer actions -- nothing is rendered (no
   * empty bar) when this is left out and nothing has been portaled into
   * the same footer via `DrawerFooter` either (see drawer-shell.module.
   * css's `:empty` rule). */
  footer?: ReactNode;
  /** Drawer width, forwarded to Mantine's own `Drawer` `size`. Omit to use
   * Mantine's own default -- every current consumer that needs a specific
   * fixed width (e.g. the Edit Module drawer's existing 500px, ANA-121)
   * passes its own value rather than this component assuming one width
   * fits every future drawer. */
  size?: string | number;
}

// Reusable right-side drawer shell for admin editor panels (ANA-122): a
// header that always stays visible (a left-pointing back arrow and the
// supplied title, never Mantine's own close/X button), a scrollable
// content region, and an optional footer pinned to the bottom for the
// consumer's own actions. Presentation-only -- it owns no editor state or
// save/dirty logic of its own (see `DrawerFooter` above for how a nested
// consumer that does own that state still gets to render into the fixed
// footer without lifting it up here). Built on Mantine's compound `Drawer.
// Root`/`Content`/`Header`/`Body` API rather than the `<Drawer>` shorthand,
// specifically so the header and footer can be real flex-column siblings
// of the scrollable body -- replacing the fixed-pixel-position title hack
// the Edit Module drawer used before this existed (see edit-module-
// drawer.tsx's prior revision), rather than approximating the same result
// with more fixed positioning.
//
// Nothing here assumes there can only be one drawer open at a time -- this
// component keeps no module-level/global state of its own (its only state,
// `footerTarget` below, is local to one instance), so mounting two
// `DrawerShell`s at once, each independently `opened`, already works with
// no extra wiring (see this file's `Stacked` story). A real nested Module
// -> Lesson drawer flow isn't implemented yet (ANA-122 leaves that for
// later) -- when it is, that's the point to reach for Mantine's own
// `Drawer.Stack`/`stackId` (so only the topmost drawer shows its overlay
// and responds to Escape), not before it's actually needed.
export function DrawerShell({
  opened,
  title,
  onClose,
  onBack,
  children,
  footer,
  size,
}: DrawerShellProps) {
  // A callback ref, not a plain `useRef` -- `DrawerFooter` (rendered by
  // whatever's inside `children`, arbitrarily deep) needs a render to see
  // the real footer node once it exists so its `createPortal` target is
  // never stale, and only a state update (not a ref mutation) triggers
  // that. This is the standard "observe a DOM node" pattern, not the
  // effect-based `setState` this project's lint config otherwise forbids
  // (see AGENTS.md) -- there's no `useEffect` here at all.
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);

  return (
    <Drawer.Root opened={opened} onClose={onClose} position="right" size={size}>
      <Drawer.Overlay />
      {/* `Drawer.Content` itself is left without a `className`/`style` of
          our own -- Mantine's own `DrawerContent` reuses whichever of
          those two props is passed here for *two* different elements: the
          visible panel (its own "content" slot, a `Paper`) and the
          invisible flex wrapper around it that actually right-aligns/
          full-height-stretches that panel (its "inner" slot). Passing our
          own flex-column layout there landed on both and broke that
          positioning (verified empirically -- the class showed up on both
          elements' `classList`). The plain `div` below carries that layout
          instead, entirely inside the unmodified `Paper`. */}
      <Drawer.Content>
        <div className={styles.content}>
          <Drawer.Header className={styles.header}>
            <Group gap="xs" wrap="nowrap">
              <ActionIconButton aria-label="Back" onClick={onBack ?? onClose}>
                <ArrowLeft size={21} aria-hidden="true" />
              </ActionIconButton>
              {/* `Drawer.Title` (not a plain element) so Mantine links the
                  dialog's `aria-labelledby` to it automatically -- the actual
                  visible typography comes from the nested `Title order={2}
                  component="span"`, so there's exactly one real heading
                  element (this one) with no nested h2-in-h2. */}
              <Drawer.Title>
                <Title order={4} component="span">
                  {title}
                </Title>
              </Drawer.Title>
            </Group>
          </Drawer.Header>

          <Drawer.Body
            className={styles.body}
            data-testid="drawer-scroll-region"
          >
            <DrawerFooterTargetContext.Provider value={footerTarget}>
              {children}
            </DrawerFooterTargetContext.Provider>
          </Drawer.Body>

          <div ref={setFooterTarget} className={styles.footer}>
            {footer}
          </div>
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
}
