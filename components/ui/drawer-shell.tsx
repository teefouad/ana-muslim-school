"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Drawer,
  DrawerStackContext,
  getDefaultZIndex,
  Group,
  Title,
} from "@mantine/core";
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
  /** Wires this drawer into an ancestor Mantine `Drawer.Stack` (re-exported
   * from `@mantine/core`, used exactly as Mantine's own docs describe) so a
   * parent drawer can stay mounted/open underneath a child one. Every
   * `DrawerShell` given a `stackId` inside the same `Drawer.Stack` still
   * dismisses independently via its own `opened`/`onClose`, but only the
   * *topmost* one (the one most recently opened) responds to Escape or an
   * outside/backdrop click, or shows its own overlay -- the same rule
   * Mantine's own stacked modals/drawers use, so closing the topmost
   * reveals whichever drawer was underneath it, rather than one Escape
   * dismissing the whole stack (see this file's `Stacked` story/tests).
   * Omit for a standalone drawer -- every prop this adds is left at
   * `Drawer.Root`'s own default in that case, so nothing here changes for
   * an existing consumer that doesn't pass it (e.g. the Edit Module
   * drawer). */
  stackId?: string;
  /** Rendered in the header, right-aligned opposite the back button/title
   * (ANA-123) -- e.g. the Edit Module drawer's own Lessons button, which
   * opens a nested drawer stacked above this one. Mantine's own
   * `ModalBaseHeader` is already `justify-content: space-between`, so this
   * needs no layout wrapper of its own to land on the opposite side from
   * the back button/title `Group`. Omit for a header with no actions beyond
   * the back button. */
  headerActions?: ReactNode;
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
// no extra wiring. Stacking two of them so only the topmost responds to
// Escape/outside dismissal (e.g. a future nested Module -> Lesson drawer)
// is opt-in via `stackId` (see this file's `Stacked` story/tests) -- built
// on Mantine's own `Drawer.Stack`/`DrawerStackContext`, not a bespoke
// mechanism of this component's own.
export function DrawerShell({
  opened,
  title,
  onClose,
  onBack,
  children,
  footer,
  size,
  stackId,
  headerActions,
}: DrawerShellProps) {
  // A callback ref, not a plain `useRef` -- `DrawerFooter` (rendered by
  // whatever's inside `children`, arbitrarily deep) needs a render to see
  // the real footer node once it exists so its `createPortal` target is
  // never stale, and only a state update (not a ref mutation) triggers
  // that. This is the standard "observe a DOM node" pattern, not the
  // effect-based `setState` this project's lint config otherwise forbids
  // (see AGENTS.md) -- there's no `useEffect` here at all.
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);

  // `Drawer.Stack`'s context, if this `DrawerShell` happens to be rendered
  // inside one -- `null` for the (still fully supported) standalone case.
  // `isStacked` additionally requires a `stackId` of our own: a `DrawerShell`
  // that doesn't opt in stays completely unaffected by an ancestor
  // `Drawer.Stack` it happens to sit inside.
  const stackCtx = useContext(DrawerStackContext);
  const isStacked = stackCtx !== null && stackId !== undefined;
  // The most-recently-opened stacked `DrawerShell` is the only one Mantine
  // considers "current" -- every prop below that's conditioned on this
  // only ever narrows behavior for a *non*-topmost stacked drawer; a
  // topmost one (or a standalone one, where `isStacked` is false) is
  // always left at `Drawer.Root`'s own regular defaults.
  const isTopmost = !isStacked || stackCtx.currentId === stackId;

  // `stackCtx.getZIndex(stackId)` derives its value from this drawer's own
  // position in `Drawer.Stack`'s own `stack` array (PR review) -- fine while
  // genuinely open, but the registration effect below deregisters
  // (`removeModal`) the instant `opened` flips to `false`, *before* Mantine's
  // own exit transition has actually finished (that transition keeps this
  // `Drawer.Root` rendered/animating for its own configured duration
  // regardless). Once deregistered, `stack.indexOf(stackId)` is `-1`, and
  // the live z-index this closing drawer would get drops below whatever's
  // still open underneath it -- so the still-sliding-out panel gets visually
  // buried by that opaque sibling instead of finishing its animation on top
  // of it (looks like the drawer "just vanishes" rather than sliding away).
  // This freezes the last real z-index this drawer had *while it was still
  // open*, and stops tracking the live value once it's not, so the closing
  // animation keeps rendering above whatever's underneath for its entire
  // duration. Same "adjust state during render" pattern as
  // `edit-module-drawer.tsx`'s own `renderedState` -- a conditional
  // `setState` call directly in the render body, not a ref or an effect.
  const liveZIndex = isStacked ? stackCtx.getZIndex(stackId) : undefined;
  const [renderedZIndex, setRenderedZIndex] = useState(liveZIndex);
  if (opened && liveZIndex !== renderedZIndex) {
    setRenderedZIndex(liveZIndex);
  }

  // Registers/deregisters this drawer with the ancestor `Drawer.Stack` (if
  // any) so it can compute stacking order and which drawer is currently
  // topmost -- mirrors Mantine's own `<Drawer>` shorthand's identical
  // registration effect for `stackId`, which isn't done automatically by
  // the compound `Drawer.Root` API this component is built on. `addModal`/
  // `removeModal` are `Drawer.Stack`'s own registration methods (their own
  // internal `setState` calls are Mantine's concern, not traceable from
  // this effect the way a local `setState` would be, so this isn't the
  // data-fetch-then-setState pattern this project's lint config forbids --
  // it's a standard "register with an external system" effect).
  //
  // `stackCtx` is deliberately left out of the dependency array (matching
  // Mantine's own identical effect) -- `Drawer.Stack` hands out a new
  // context value object every time its own `stack`/`maxZIndex` state
  // changes, including as a *result* of this same effect's own `addModal`/
  // `removeModal` calls. Depending on `stackCtx` here would re-run this
  // effect on every one of those re-renders too, calling `addModal`/
  // `removeModal` again, producing another new context value, and so on --
  // an infinite render loop (confirmed empirically once, see this file's
  // git history). `isStacked`/`opened`/`stackId` alone are exactly the
  // real inputs that should ever re-trigger (de)registration.
  useEffect(() => {
    if (!isStacked) {
      return;
    }

    if (opened) {
      stackCtx.addModal(stackId, getDefaultZIndex("modal"));
    } else {
      stackCtx.removeModal(stackId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStacked, opened, stackId]);

  return (
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position="right"
      size={size}
      zIndex={renderedZIndex}
      closeOnEscape={isStacked ? isTopmost : undefined}
      trapFocus={isStacked ? isTopmost : undefined}
    >
      <Drawer.Overlay
        visible={isStacked ? isTopmost : undefined}
        transitionProps={isStacked ? { duration: 0 } : undefined}
      />
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
            {headerActions}
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
