import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListHeaderAction } from "./list-header-action";

describe("ListHeaderAction", () => {
  it("renders a plain button, not Mantine chrome", () => {
    render(
      <ListHeaderAction
        icon={<span aria-hidden="true">icon</span>}
        onClick={() => {}}
      >
        New
      </ListHeaderAction>,
    );

    const button = screen.getByRole("button", { name: "New" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).not.toMatch(/mantine-Button-root/);
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <ListHeaderAction
        icon={<span aria-hidden="true">icon</span>}
        onClick={onClick}
      >
        New
      </ListHeaderAction>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(onClick).toHaveBeenCalled();
  });

  it("supports a disabled state", () => {
    render(
      <ListHeaderAction icon={<span aria-hidden="true">icon</span>} disabled>
        Generate
      </ListHeaderAction>,
    );

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });
});
