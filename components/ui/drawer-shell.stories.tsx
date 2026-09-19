import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, Group, Stack, Text } from "@mantine/core";

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

// Verifies the shared component doesn't assume there can only be one
// drawer globally (ANA-122): two independent `DrawerShell`s, both mounted
// and `opened` at once -- `DrawerShell` keeps no state of its own beyond
// one instance's own footer-portal target, so nothing here needed any
// extra wiring to let a second instance open without unmounting the first.
// No production nested Module -> Lesson drawer flow is implemented yet
// (out of scope for ANA-122); when it is, that's the point to reach for
// Mantine's own `Drawer.Stack`/`stackId` so only the topmost drawer shows
// its own overlay and responds to Escape, rather than both at once as this
// simple example does.
function StackedDemo() {
  const [parentOpened, setParentOpened] = useState(true);
  const [childOpened, setChildOpened] = useState(true);

  return (
    <>
      <DrawerShell
        opened={parentOpened}
        onClose={() => setParentOpened(false)}
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
        title="Edit Lesson"
        size="min(420px, 100vw)"
      >
        <Text>
          Backing out of this child drawer reveals the parent again, rather than
          closing the whole stack.
        </Text>
      </DrawerShell>
    </>
  );
}

export const Stacked: Story = {
  args: {
    children: null,
  },
  render: () => <StackedDemo />,
};
