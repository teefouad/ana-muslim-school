import { useState } from "react";
import { Drawer, MantineProvider } from "@mantine/core";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DrawerFooter,
  DrawerShell,
  type DrawerShellProps,
} from "./drawer-shell";

function renderDrawer(overrides: Partial<DrawerShellProps> = {}) {
  const props: DrawerShellProps = {
    opened: true,
    title: "Edit Module",
    onClose: vi.fn(),
    children: <div>Content</div>,
    ...overrides,
  };

  render(
    <MantineProvider>
      <DrawerShell {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("DrawerShell", () => {
  it("renders nothing when not opened", () => {
    renderDrawer({ opened: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a dialog whose accessible name is the supplied title", () => {
    renderDrawer({ title: "Edit Module" });

    expect(
      screen.getByRole("dialog", { name: "Edit Module" }),
    ).toBeInTheDocument();
  });

  it("renders the title as an h2 heading, matching Title order={2}'s own heading level", () => {
    renderDrawer({ title: "Edit Module" });

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Edit Module",
    });
    expect(heading.tagName).toBe("H2");
  });

  it("renders a left-pointing back button in the header", () => {
    renderDrawer();

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("never renders Mantine's own close/X button -- the back button is the only header control", () => {
    renderDrawer();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveAccessibleName("Back");
  });

  it("calls onClose when the back button is clicked and no onBack is given", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onBack, not onClose, when the back button is clicked and onBack is given", () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    renderDrawer({ onClose, onBack });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape (outside/backdrop dismissal funnels through the same Mantine onClose)", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders supplied footer content", () => {
    renderDrawer({ footer: <button type="button">Save changes</button> });

    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("renders no footer content at all when none is supplied", () => {
    renderDrawer();

    // The back button is the only control in the tree -- no empty footer
    // bar/content is rendered when `footer` is omitted.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("DrawerFooter portals nested content into the same footer region as the `footer` prop", () => {
    function NestedFooter() {
      return (
        <DrawerFooter>
          <button type="button">Save changes</button>
        </DrawerFooter>
      );
    }

    renderDrawer({ children: <NestedFooter /> });

    const dialog = screen.getByRole("dialog", { name: "Edit Module" });
    expect(
      within(dialog).getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("keeps the header and footer outside the scrollable content region", () => {
    renderDrawer({
      title: "Edit Module",
      footer: <button type="button">Save changes</button>,
      children: <div data-testid="body-content">Content</div>,
    });

    const scrollRegion = screen.getByTestId("drawer-scroll-region");

    expect(
      within(scrollRegion).getByTestId("body-content"),
    ).toBeInTheDocument();
    expect(
      within(scrollRegion).queryByRole("heading", { name: "Edit Module" }),
    ).not.toBeInTheDocument();
    expect(
      within(scrollRegion).queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      within(scrollRegion).queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
  });
});

/** Two `DrawerShell`s sharing one `Drawer.Stack` (PR review, ANA-122): a
 * "parent" opened first and a "child" opened second/above it, each with its
 * own `onClose` spy plumbed through real local state so closing one via
 * Escape actually unmounts/deregisters it -- not just a spy call -- letting
 * a second Escape then reach whichever drawer is topmost next. */
function renderStackedDrawers({
  onParentClose,
  onChildClose,
}: {
  onParentClose: () => void;
  onChildClose: () => void;
}) {
  function StackedHarness() {
    const [parentOpened, setParentOpened] = useState(true);
    const [childOpened, setChildOpened] = useState(true);

    return (
      <Drawer.Stack>
        <DrawerShell
          opened={parentOpened}
          onClose={() => {
            setParentOpened(false);
            onParentClose();
          }}
          stackId="parent"
          title="Parent"
        >
          <div>Parent content</div>
        </DrawerShell>
        <DrawerShell
          opened={childOpened}
          onClose={() => {
            setChildOpened(false);
            onChildClose();
          }}
          stackId="child"
          title="Child"
        >
          <div>Child content</div>
        </DrawerShell>
      </Drawer.Stack>
    );
  }

  return render(
    <MantineProvider>
      <StackedHarness />
    </MantineProvider>,
  );
}

describe("DrawerShell stacking (Drawer.Stack/stackId, ANA-122 PR review)", () => {
  it("both a stacked parent and child can be open/mounted at once", () => {
    renderStackedDrawers({ onParentClose: vi.fn(), onChildClose: vi.fn() });

    expect(screen.getByRole("dialog", { name: "Parent" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Child" })).toBeInTheDocument();
  });

  it("Escape dismisses only the topmost (child) drawer, not the parent underneath it", () => {
    const onParentClose = vi.fn();
    const onChildClose = vi.fn();
    renderStackedDrawers({ onParentClose, onChildClose });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onChildClose).toHaveBeenCalledTimes(1);
    expect(onParentClose).not.toHaveBeenCalled();
  });

  it("a second Escape then dismisses the parent, once it has become the topmost drawer", () => {
    const onParentClose = vi.fn();
    const onChildClose = vi.fn();
    renderStackedDrawers({ onParentClose, onChildClose });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(onChildClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(onParentClose).toHaveBeenCalledTimes(1);
  });

  it("only the topmost drawer's overlay is visible/clickable -- clicking it dismisses only the child", async () => {
    const onParentClose = vi.fn();
    const onChildClose = vi.fn();
    const { container } = renderStackedDrawers({ onParentClose, onChildClose });

    const overlays = () =>
      Array.from(
        container.ownerDocument.querySelectorAll(".mantine-Overlay-root"),
      ) as HTMLElement[];

    await waitFor(() => {
      const visible = overlays().filter(
        (el) => getComputedStyle(el).opacity !== "0",
      );
      expect(visible).toHaveLength(1);
    });

    const [visibleOverlay] = overlays().filter(
      (el) => getComputedStyle(el).opacity !== "0",
    );
    fireEvent.click(visibleOverlay);

    expect(onChildClose).toHaveBeenCalledTimes(1);
    expect(onParentClose).not.toHaveBeenCalled();
  });

  it("a standalone (non-stacked) DrawerShell is unaffected by these props -- Escape still closes it normally", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
