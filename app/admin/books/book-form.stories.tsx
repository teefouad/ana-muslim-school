import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, Group } from "@mantine/core";

import {
  BookForm,
  createEmptyBookFormValues,
  type BookFormValues,
} from "./book-form";

const SEALED_NECTAR_VALUES: BookFormValues = {
  title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
  description: {
    ar: "سيرة النبي محمد صلى الله عليه وسلم.",
    en: "A biography of the Prophet Muhammad.",
  },
  longDescription: {
    ar: "**سيرة** كاملة للنبي محمد صلى الله عليه وسلم.",
    en: "A **full biography** of the Prophet Muhammad.",
  },
  imageId: "sealed-nectar",
  isLocked: false,
  isPublished: true,
  color: "#1c7ed6",
};

const STORY_FORM_ID = "book-form-story";

const meta = {
  title: "Books/BookForm",
  component: BookForm,
  tags: ["autodocs"],
  args: {
    id: STORY_FORM_ID,
    onSubmit: () => {},
  },
  render: (args) => (
    <div style={{ width: 560 }}>
      <BookForm {...args} />
      {/* Mirrors how the Add/Edit Book pages submit this form from a
          page-header button (ANA-61) -- via the HTML `form` attribute,
          not a duplicated bottom button inside the form itself. */}
      <Group justify="flex-end" mt="lg">
        <Button type="submit" form={args.id}>
          Submit
        </Button>
      </Group>
    </div>
  ),
} satisfies Meta<typeof BookForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    initialValues: createEmptyBookFormValues(),
  },
};

export const ArabicAndEnglishValues: Story = {
  args: {
    initialValues: SEALED_NECTAR_VALUES,
  },
};

export const LockedAndUnpublished: Story = {
  args: {
    initialValues: {
      ...SEALED_NECTAR_VALUES,
      isLocked: true,
      isPublished: false,
      color: "#e8590c",
    },
  },
};

// Locked and Published both checked at once (ANA-63): both use the same
// `error`-variant ToggleCard treatment, so their checked appearance should
// be identical.
export const LockedAndPublished: Story = {
  args: {
    initialValues: {
      ...SEALED_NECTAR_VALUES,
      isLocked: true,
      isPublished: true,
    },
  },
};

// Same BookForm the Add Book page uses, but with an existing book's values
// prefilled -- what the Edit Book page renders (see [id]/edit/page.tsx).
export const EditPrefilled: Story = {
  args: {
    initialValues: {
      title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
      description: {
        ar: "مجموعة من الأحاديث النبوية الصحيحة.",
        en: "A collection of authentic prophetic hadiths.",
      },
      longDescription: { ar: "", en: "" },
      imageId: "riyad-as-salihin",
      isLocked: true,
      isPublished: false,
      color: "#2f9e44",
    },
  },
};

// Color holds a named application palette token rather than a hex string
// (ANA-63) -- focus the field to see the full suggestion list drawn from
// `APPLICATION_COLOR_TOKENS`, or type to filter it. Free-form values (a raw
// hex string, say) remain accepted alongside these suggestions.
export const NamedColorToken: Story = {
  args: {
    initialValues: {
      ...SEALED_NECTAR_VALUES,
      color: "blue.7",
    },
  },
};
