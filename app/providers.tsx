"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";

import { cssVariablesResolver, theme } from "@/lib/mantine/theme";

// A dedicated Client Component so `cssVariablesResolver` (a function) never
// has to cross the Server -> Client Component prop boundary from the root
// layout -- only serializable props can cross that boundary.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="dark"
    >
      {children}
    </MantineProvider>
  );
}
