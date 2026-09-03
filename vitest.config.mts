import path from "node:path";

import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

import { playwright } from "@vitest/browser-playwright";

const dirname = import.meta.dirname;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
      // Next.js's webpack config swaps this for a no-op in server bundles;
      // Vitest doesn't apply that swap, so alias it ourselves. See
      // vitest.server-only-stub.ts.
      "server-only": path.join(dirname, "vitest.server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: [path.join(dirname, "vitest.setup.ts")],
          include: ["app/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          // For server-only modules (guarded with the `server-only`
          // package) and any Node-only code, run outside jsdom.
          name: "server",
          environment: "node",
          globals: true,
          include: ["lib/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
