import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { TempModule } from "./import-source-types";
import {
  LearningMaterialView,
  type LearningMaterialViewProps,
} from "./learning-material-view";

const SAMPLE_MODULES: TempModule[] = [
  { id: "module-1", text: "نص الصفحة الأولى الذي تم استخراجه." },
  { id: "module-2", text: "نص الفصل الأول من الوثيقة." },
];

function LearningMaterialViewDemo(props: LearningMaterialViewProps) {
  const [fontScale, setFontScale] = useState(props.fontScale);
  const [direction, setDirection] = useState(props.direction);
  const [learningMaterials, setLearningMaterials] = useState(
    props.learningMaterials,
  );

  return (
    <LearningMaterialView
      {...props}
      fontScale={fontScale}
      onFontScaleChange={setFontScale}
      direction={direction}
      onDirectionChange={setDirection}
      learningMaterials={learningMaterials}
      onLearningMaterialsChange={setLearningMaterials}
    />
  );
}

const meta = {
  title: "Books/ImportSource/LearningMaterialView",
  component: LearningMaterialView,
  tags: ["autodocs"],
  args: {
    fileName: "the-sealed-nectar.pdf",
    modules: SAMPLE_MODULES,
    learningMaterials: {},
    onLearningMaterialsChange: () => {},
    fontScale: 100,
    direction: "rtl" as const,
    onFontScaleChange: () => {},
    onDirectionChange: () => {},
    onBack: () => {},
    onFinish: () => {},
    isFinishing: false,
    finishError: null,
    backDisabled: false,
  },
  render: (args) => (
    <div style={{ height: "80vh" }}>
      <LearningMaterialViewDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LearningMaterialView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLearningMaterial: Story = {
  args: {
    learningMaterials: {
      "module-1": "## الدرس الأول\n\nملخص الدرس الأول.",
    },
  },
};

export const NoModulesFinishDisabled: Story = {
  args: { modules: [] },
};

export const Finishing: Story = {
  args: { isFinishing: true },
};

export const FinishFailed: Story = {
  args: {
    finishError: "Could not create Module 2. Please try again.",
  },
};

// After a partial failure (Module 1 already created, Module 2 failed),
// Back to Modules is disabled -- the temporary set can no longer be
// reordered/deleted out from under an already-persisted Module (PR review,
// ANA-70). Retrying Finish is the only way forward from here.
export const PartialFailureBackDisabled: Story = {
  args: {
    finishError: "Could not create Module 2. Please try again.",
    backDisabled: true,
  },
};
