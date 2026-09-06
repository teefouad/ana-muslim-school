import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { MockSection } from "./mock-sections";
import { SectionsPanel, type SectionsPanelProps } from "./sections-panel";

const SAMPLE_SECTIONS: MockSection[] = [
  { id: "section-1", title: "Introduction" },
  { id: "section-2", title: "Prayer basics" },
  { id: "section-3", title: "Summary" },
];

const MANY_SECTIONS: MockSection[] = Array.from({ length: 12 }, (_, index) => ({
  id: `section-${index + 1}`,
  // Every third section has a blank title to also demonstrate the
  // "Section N" fallback label alongside the overflow/scroll behavior.
  title: index % 3 === 0 ? "" : `Section title ${index + 1}`,
}));

// Wraps SectionsPanel with local state so reorder/Add section behave for
// real in Storybook, the same way the Add/Edit Book pages own that state
// (ANA-61) -- the component itself is fully controlled and has no state.
function SectionsPanelDemo({
  sections: initialSections,
  onSectionsChange,
  ...rest
}: SectionsPanelProps) {
  const [sections, setSections] = useState(initialSections);

  return (
    <SectionsPanel
      {...rest}
      sections={sections}
      onSectionsChange={(next) => {
        setSections(next);
        onSectionsChange(next);
      }}
    />
  );
}

const meta = {
  title: "Books/SectionsPanel",
  component: SectionsPanel,
  tags: ["autodocs"],
  args: {
    onSectionsChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 320, height: 420 }}>
      <SectionsPanelDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof SectionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    sections: SAMPLE_SECTIONS,
  },
};

export const Empty: Story = {
  args: {
    sections: [],
  },
};

// Add Book before its first save: visible, but reordering and Add section
// are suspended until the mock Book exists (ANA-61).
export const Disabled: Story = {
  args: {
    sections: SAMPLE_SECTIONS,
    disabled: true,
  },
};

export const ManySectionsOverflow: Story = {
  args: {
    sections: MANY_SECTIONS,
  },
};
