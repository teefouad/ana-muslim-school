import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, Drawer, Group, Stack, Text } from "@mantine/core";

import { DrawerFooter, DrawerShell } from "./drawer-shell";

function LongContent() {
  return (
    <Stack gap="md">
      {Array.from({ length: 20 }).map((_, index) => (
        <Text key={index}>
          Row {index + 1} -- long content to demonstrate that only this region
          scrolls, while the header and footer stay in place.
        </Text>
      ))}
    </Stack>
  );
}

const meta = {
  title: "UI/DrawerShell",
  component: DrawerShell,
  tags: ["autodocs"],
  args: {
    opened: true,
    title: "Edit Module",
    onClose: () => {},
    size: "min(500px, 100vw)",
  },
} satisfies Meta<typeof DrawerShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <LongContent />,
    footer: (
      <Group justify="flex-end" gap="sm">
        <Button variant="default">Cancel</Button>
        <Button>Save changes</Button>
      </Group>
    ),
  },
};

// No `footer` supplied and nothing portaled into it via `DrawerFooter` --
// the footer region renders nothing at all (no empty bordered bar), same
// as the Module editor's own Lesson mode inside the Edit Module drawer,
// which keeps its own inline Save action instead of using this footer.
export const NoFooter: Story = {
  args: {
    children: <LongContent />,
  },
};

// Demonstrates `DrawerFooter`: a component nested inside the scrollable
// `children` -- arbitrarily far from `DrawerShell` itself -- portals its
// own actions into the fixed footer instead of the caller having to lift
// that component's state up into `footer` directly (ANA-122; see
// edit-module-drawer.tsx/module-editor-body.tsx for the real usage this
// mirrors).
function NestedFooterDemo() {
  const [count, setCount] = useState(0);

  return (
    <Stack gap="md">
      <Text>
        This button&apos;s own click count lives in a component nested inside
        the scrollable content, yet its Save action below is portaled into the
        drawer&apos;s fixed footer.
      </Text>
      <Button variant="default" onClick={() => setCount((c) => c + 1)}>
        Clicked {count} times
      </Button>
      <LongContent />
      <DrawerFooter>
        <Group justify="flex-end" gap="sm">
          <Button variant="default">Cancel</Button>
          <Button>Save ({count})</Button>
        </Group>
      </DrawerFooter>
    </Stack>
  );
}

export const FooterPortal: Story = {
  args: {
    children: <NestedFooterDemo />,
  },
};

// Verifies the shared component supports Mantine's own real drawer-
// stacking behavior (ANA-122 PR review) rather than merely letting two
// independent `DrawerShell`s coexist: both wired into the same `stackId`-
// bearing `Drawer.Stack`, both stay mounted/open at once, but only the
// topmost (the child, opened after the parent) shows its own overlay and
// responds to Escape/outside-click -- see drawer-shell.test.tsx's own
// assertions of this same behavior. No production nested Module -> Lesson
// drawer flow is implemented yet (out of scope for ANA-122); this only
// shows the shared component itself already supports that shape.
function StackedDemo() {
  const [parentOpened, setParentOpened] = useState(true);
  const [childOpened, setChildOpened] = useState(true);

  return (
    <Drawer.Stack>
      <DrawerShell
        opened={parentOpened}
        onClose={() => setParentOpened(false)}
        stackId="parent"
        title="Edit Module"
        size="min(500px, 100vw)"
      >
        <Stack gap="md">
          <Text>The parent drawer stays mounted while the child is open.</Text>
          <Button onClick={() => setChildOpened(true)}>Add Lesson</Button>
        </Stack>
      </DrawerShell>

      <DrawerShell
        opened={childOpened}
        onClose={() => setChildOpened(false)}
        onBack={() => setChildOpened(false)}
        stackId="child"
        title="Edit Lesson"
        size="min(420px, 100vw)"
      >
        <Text>
          Escape or an outside click here only ever dismisses this child drawer,
          revealing the parent again -- the parent&apos;s own Escape/
          outside-click handling only resumes once this child has closed.
        </Text>
      </DrawerShell>
    </Drawer.Stack>
  );
}

export const Stacked: Story = {
  args: {
    children: null,
  },
  render: () => <StackedDemo />,
};
