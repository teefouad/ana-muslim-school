import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SaveButton } from "./save-button";

function renderButton(dirty: boolean, onClick = vi.fn()) {
  render(
    <MantineProvider>
      <SaveButton dirty={dirty} onClick={onClick}>
        Save changes
      </SaveButton>
    </MantineProvider>,
  );
  return onClick;
}

describe("SaveButton", () => {
  it("renders Mantine's dark color (reads as black) when there are no unsaved changes", () => {
    renderButton(false);

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveClass("mantine-Button-root");
    // Mantine sets an explicit `color` prop's resolved background as an
    // inline CSS custom property (Button.mjs's own `varsResolver`) --
    // asserting on the exact variable name pins this to the "dark" color
    // specifically, not merely "some color was set".
    expect(button.style.getPropertyValue("--button-bg")).toBe(
      "var(--mantine-color-dark-filled)",
    );
  });

  it("leaves color at Button's own default (the theme's usual primary green) once there are unsaved changes", () => {
    renderButton(true);

    const button = screen.getByRole("button", { name: "Save changes" });
    // No explicit `color` prop here -- Mantine's `varsResolver` only sets
    // `--button-bg` inline when a `color`/`variant` prop is actually given
    // (Button.mjs), so its absence means Button falls back to its own
    // compiled default background, this theme's usual primary green
    // (`--mantine-primary-color-filled`, globals.css) -- the same "no
    // override" case every other primary Button in this app already gets.
    expect(button.style.getPropertyValue("--button-bg")).toBe("");
  });

  it("calls onClick when clicked", () => {
    const onClick = renderButton(true);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onClick).toHaveBeenCalled();
  });

  it("passes through ordinary Button props like disabled/loading", () => {
    render(
      <MantineProvider>
        <SaveButton dirty disabled>
          Save changes
        </SaveButton>
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
