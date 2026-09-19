import {
  createTheme,
  defaultCssVariablesResolver,
  type CSSVariablesResolver,
} from "@mantine/core";

// Falls back to Mantine's own default stack (see DEFAULT_FONT_FAMILY in
// @mantine/core) if the `--font-inter` variable from `next/font/google`
// (wired onto <html> in app/layout.tsx) isn't present -- e.g. a test/
// Storybook render that mounts this theme without that layout.
const FONT_FAMILY =
  "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji";

export const theme = createTheme({
  // Inter as the admin dashboard's primary font (ANA-105), set once here so
  // every Mantine component -- pages, forms, modals, tables, and every
  // components/ui primitive -- picks it up consistently rather than each
  // screen opting in on its own. Arabic-language fields keep rendering in
  // the browser's own fallback sans-serif (the stack above, same as before
  // this change) since Inter itself has no Arabic glyphs.
  fontFamily: FONT_FAMILY,
  headings: {
    fontFamily: FONT_FAMILY,
  },
  components: {
    // Elevated surfaces (the login card, form panels) stay at Mantine's
    // default dark-mode body shade so they read as a step above the app
    // background -- see `cssVariablesResolver` below, which darkens the
    // actual body/page background past it.
    Paper: {
      defaultProps: {
        bg: "dark.7",
      },
    },
    // Modal content is a Paper (bg dark.7, see above), but its header uses
    // the raw body background var, which `cssVariablesResolver` darkens to
    // dark.9 -- pin it back to the Paper shade so the title bar doesn't
    // read as a darker band than the rest of the modal.
    Modal: {
      styles: {
        header: {
          backgroundColor: "var(--mantine-color-dark-7)",
        },
      },
    },
    // Drawer shares Modal's own header/body structure (both built on
    // Mantine's ModalBase) and so has the same darker-header mismatch --
    // same fix (ANA-121, the Edit Module drawer).
    Drawer: {
      styles: {
        header: {
          backgroundColor: "var(--mantine-color-dark-7)",
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          transition: "background-color 150ms ease",
        },
      },
    },
    Table: {
      vars: () => ({
        table: {
          "--table-border-color": "#202020",
        },
        tr: {
          "--tr-hover-bg": "#161616",
        },
      }),
      styles: {
        tr: {
          transition: "background-color 150ms ease",
        },
      },
    },
    TextInput: {
      styles: {
        label: {
          marginBottom: 5,
        },
      },
    },
    // Matches TextInput's own label spacing above (ANA-129) -- without
    // this, NumberInput's label keeps Mantine's own default margin instead,
    // so a `TextInput`/`NumberInput` pair sharing one row (e.g. a Video
    // Lesson's Video URL/Duration fields, lesson-form.tsx) has each
    // input's own box start at a different vertical offset even though
    // both labels are a single line.
    NumberInput: {
      styles: {
        label: {
          marginBottom: 5,
        },
      },
    },
  },
});

export const cssVariablesResolver: CSSVariablesResolver = (t) => {
  const base = defaultCssVariablesResolver(t);

  return {
    ...base,
    dark: {
      ...base.dark,

      "--mantine-color-body": "var(--background)",
    },
  };
};
