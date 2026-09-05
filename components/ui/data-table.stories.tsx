import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@mantine/core";

import { DataTable, type DataTableColumn } from "./data-table";

const meta = {
  title: "UI/DataTable",
  component: DataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

interface DemoItem {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

const ITEMS: DemoItem[] = [
  {
    id: "1",
    name: "Amina Yusuf",
    email: "amina@example.com",
    role: "Admin",
    active: true,
  },
  {
    id: "2",
    name: "Bilal Karim",
    email: "bilal@example.com",
    role: "Editor",
    active: true,
  },
  {
    id: "3",
    name: "Fatima Noor",
    email: "fatima@example.com",
    role: "Viewer",
    active: false,
  },
];

const COLUMNS: DataTableColumn<DemoItem>[] = [
  { key: "name", header: "Name", render: (item) => item.name },
  { key: "email", header: "Email", render: (item) => item.email },
  { key: "role", header: "Role", render: (item) => item.role },
  {
    key: "status",
    header: "Status",
    render: (item) => (
      <Badge color={item.active ? "green" : "gray"} variant="light">
        {item.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

// `args` only exists to satisfy StoryObj's required-props type for a
// *generic* component -- `DataTable<T>`'s props collapse to `unknown` once
// run through `Meta<typeof DataTable>` (Storybook's Meta/StoryObj helpers
// don't preserve a component's own type parameter), so the values below are
// cast rather than genuinely type-checked. `render` ignores them entirely --
// each story owns its own state and renders the real, correctly-typed
// `<DataTable<DemoItem>>` itself, same convention as item-list.stories.tsx.
function Demo({
  editable,
  deletable,
  items: initialItems = ITEMS,
  minWidth,
}: {
  editable: boolean;
  deletable: boolean;
  items?: DemoItem[];
  minWidth?: number;
}) {
  const [items, setItems] = useState(initialItems);

  return (
    <div style={{ width: 700 }}>
      <DataTable
        items={items}
        getItemId={(item) => item.id}
        columns={COLUMNS}
        emptyState="No records yet."
        minWidth={minWidth}
        onEditItem={editable ? () => {} : undefined}
        getEditLabel={(item) => `Edit ${item.name}`}
        onDeleteItem={
          deletable
            ? (item) => setItems((current) => current.filter((i) => i !== item))
            : undefined
        }
        getDeleteLabel={(item) => `Delete ${item.name}`}
      />
    </div>
  );
}

// Hover or focus a row to reveal its Edit and Delete actions.
export const Default: Story = {
  args: {
    items: ITEMS,
    getItemId: (item: DemoItem) => item.id,
    columns: COLUMNS,
    emptyState: "No records yet.",
  } as Story["args"],
  render: () => <Demo editable deletable />,
};

export const EditOnly: Story = {
  args: Default.args,
  render: () => <Demo editable deletable={false} />,
};

export const DeleteOnly: Story = {
  args: Default.args,
  render: () => <Demo editable={false} deletable />,
};

// No `onEditItem`/`onDeleteItem` -- the actions column doesn't render at
// all, matching a read-only viewer.
export const ReadOnly: Story = {
  args: Default.args,
  render: () => <Demo editable={false} deletable={false} />,
};

export const Empty: Story = {
  args: Default.args,
  render: () => <Demo editable deletable items={[]} />,
};

// A wide column set with a generous `minWidth` makes the table scroll
// horizontally inside its own container rather than squeezing columns or
// overflowing the page.
export const HorizontalOverflow: Story = {
  args: Default.args,
  render: () => (
    <div style={{ width: 420 }}>
      <DataTable
        items={ITEMS}
        getItemId={(item) => item.id}
        columns={[
          ...COLUMNS,
          { key: "id", header: "ID", render: (item) => item.id },
        ]}
        emptyState="No records yet."
        minWidth={900}
        onEditItem={() => {}}
        getEditLabel={(item) => `Edit ${item.name}`}
        onDeleteItem={() => {}}
        getDeleteLabel={(item) => `Delete ${item.name}`}
      />
    </div>
  ),
};
