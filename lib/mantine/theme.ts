import {
  createTheme,
  defaultCssVariablesResolver,
  type CSSVariablesResolver,
} from "@mantine/core";

export const theme = createTheme({
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
        input: {
          borderColor: "#292929",
          backgroundColor: "#1a1a1a",
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
