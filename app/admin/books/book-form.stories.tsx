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
    ar: "**سيرة** النبي محمد صلى الله عليه وسلم.",
    en: "A **biography** of the Prophet Muhammad.",
  },
  imageId: "sealed-nectar",
  locked: false,
  published: true,
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
      locked: true,
      published: false,
      color: "#e8590c",
    },
  },
};

// Same BookForm the Add Book page uses, but with an existing mock book's
// values prefilled -- what the Edit Book page renders (see
// [id]/edit/page.tsx).
export const EditPrefilled: Story = {
  args: {
    initialValues: {
      title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
      description: {
        ar: "مجموعة من الأحاديث النبوية الصحيحة.",
        en: "A collection of authentic prophetic hadiths.",
      },
      imageId: "riyad-as-salihin",
      locked: true,
      published: false,
      color: "#2f9e44",
    },
  },
};
