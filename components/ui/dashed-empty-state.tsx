"use client";

import type { ReactNode } from "react";
import { Box, Text } from "@mantine/core";

export interface DashedEmptyStateProps {
  children: ReactNode;
}

// A centered message inside a dashed, rounded box -- the empty-state
// treatment for a bare list with no outer card of its own to lean on for a
// boundary (unlike ItemList's own `emptyState`, which relies on the
// ItemList card's own border instead, see item-list.module.css). Originated
// in the Questions editor's own "No questions yet." state (ANA-119);
// extracted here (ANA-129) so the Break entries list -- required to match
// the Questions list's own empty-state treatment -- reuses it rather than
// duplicating the same box.
export function DashedEmptyState({ children }: DashedEmptyStateProps) {
  return (
    <Box
      style={{
        border: "1px dashed var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)",
        padding: "var(--mantine-spacing-lg)",
        textAlign: "center",
      }}
    >
      <Text size="sm" c="dimmed">
        {children}
      </Text>
    </Box>
  );
}
