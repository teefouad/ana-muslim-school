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
  },
});

export const cssVariablesResolver: CSSVariablesResolver = (t) => {
  const base = defaultCssVariablesResolver(t);

  return {
    ...base,
    dark: {
      ...base.dark,
      "--mantine-color-body": "var(--mantine-color-dark-9)",
    },
  };
};
