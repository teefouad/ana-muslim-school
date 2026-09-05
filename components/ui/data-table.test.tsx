import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { DataTable, type DataTableColumn } from "./data-table";

interface DemoItem {
  id: string;
  name: string;
  email: string;
}

const items: DemoItem[] = [
  { id: "a", name: "Alpha", email: "alpha@example.com" },
  { id: "b", name: "Beta", email: "beta@example.com" },
];

const columns: DataTableColumn<DemoItem>[] = [
  { key: "name", header: "Name", render: (item) => item.name },
  { key: "email", header: "Email", render: (item) => item.email },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof DataTable<DemoItem>>> = {},
) {
  return render(
    <MantineProvider>
      <DataTable
        items={items}
        getItemId={(item) => item.id}
        columns={columns}
        emptyState="Nothing here."
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("DataTable", () => {
  test("renders headers and cells from the supplied columns", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("beta@example.com")).toBeInTheDocument();
  });

  test("uses the supplied id as each row's stable key", () => {
    const { rerender } = render(
      <MantineProvider>
        <DataTable
          items={items}
          getItemId={(item) => item.id}
          columns={columns}
          emptyState="Nothing here."
          getRowTestId={(item, id) => `row-${id}`}
        />
      </MantineProvider>,
    );

    const rowBefore = screen.getByTestId("row-a");

    rerender(
      <MantineProvider>
        <DataTable
          items={[items[1]!, items[0]!]}
          getItemId={(item) => item.id}
          columns={columns}
          emptyState="Nothing here."
          getRowTestId={(item, id) => `row-${id}`}
        />
      </MantineProvider>,
    );

    expect(screen.getByTestId("row-a")).toBe(rowBefore);
  });

  test("renders the empty state when there are no items", () => {
    renderTable({ items: [] });
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("invokes onEditItem with the clicked row's item and index", () => {
    const onEditItem = vi.fn();
    renderTable({
      onEditItem,
      getEditLabel: (item) => `Edit ${item.name}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Beta" }));

    expect(onEditItem).toHaveBeenCalledTimes(1);
    expect(onEditItem).toHaveBeenCalledWith(items[1], 1);
  });

  test("invokes onDeleteItem with the clicked row's item and index", () => {
    const onDeleteItem = vi.fn();
    renderTable({
      onDeleteItem,
      getDeleteLabel: (item) => `Delete ${item.name}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));

    expect(onDeleteItem).toHaveBeenCalledTimes(1);
    expect(onDeleteItem).toHaveBeenCalledWith(items[0], 0);
  });

  test("clicking Delete never invokes onEditItem", () => {
    const onEditItem = vi.fn();
    const onDeleteItem = vi.fn();
    renderTable({
      onEditItem,
      getEditLabel: (item) => `Edit ${item.name}`,
      onDeleteItem,
      getDeleteLabel: (item) => `Delete ${item.name}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));

    expect(onDeleteItem).toHaveBeenCalledTimes(1);
    expect(onEditItem).not.toHaveBeenCalled();
  });

  test("omitting onEditItem hides the edit action but keeps delete", () => {
    renderTable({
      onDeleteItem: () => {},
      getDeleteLabel: (item) => `Delete ${item.name}`,
    });

    expect(
      screen.queryByRole("button", { name: /Edit/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Delete/ })).toHaveLength(2);
  });

  test("omitting both action callbacks renders no actions column", () => {
    renderTable();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("exposes accessible labels via aria-label and tooltip", () => {
    renderTable({
      onEditItem: () => {},
      getEditLabel: (item) => `Edit ${item.name}`,
    });

    expect(
      screen.getByRole("button", { name: "Edit Alpha" }),
    ).toBeInTheDocument();
  });
});
