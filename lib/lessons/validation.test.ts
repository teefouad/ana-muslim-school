import { describe, expect, it } from "vitest";

import { parseLessonCreateInput, parseLessonPatchInput } from "./validation";

const validBody = {
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  type: "text",
  position: 1,
  reward: { coins: 0 },
  duration: 0,
  videoURL: "",
  azkar: [],
  questions: [],
  isLocked: false,
  isPublished: false,
};

describe("parseLessonCreateInput", () => {
  it("accepts a fully valid body", () => {
    const result = parseLessonCreateInput(validBody);

    expect(result.ok).toBe(true);
  });

  it.each(["position", "duration"])(
    "rejects a non-finite `%s` (Infinity, e.g. from JSON 1e400)",
    (field) => {
      const result = parseLessonCreateInput({
        ...validBody,
        [field]: Infinity,
      });

      expect(result.ok).toBe(false);
    },
  );

  it.each(["position", "duration"])("rejects NaN for `%s`", (field) => {
    const result = parseLessonCreateInput({ ...validBody, [field]: NaN });

    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite `reward.coins`", () => {
    const result = parseLessonCreateInput({
      ...validBody,
      reward: { coins: Infinity },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite `azkar[].repeat`", () => {
    const result = parseLessonCreateInput({
      ...validBody,
      azkar: [{ text: { ar: "أ", en: "a" }, repeat: Infinity }],
    });

    expect(result.ok).toBe(false);
  });
});

describe("parseLessonPatchInput", () => {
  it.each(["position", "duration"])(
    "rejects a non-finite `%s` in a partial patch",
    (field) => {
      const result = parseLessonPatchInput({ [field]: Infinity });

      expect(result.ok).toBe(false);
    },
  );

  it("rejects a non-finite `reward.coins` in a partial patch", () => {
    const result = parseLessonPatchInput({ reward: { coins: NaN } });

    expect(result.ok).toBe(false);
  });

  it("accepts a finite `position` in a partial patch", () => {
    const result = parseLessonPatchInput({ position: 42 });

    expect(result).toEqual({ ok: true, value: { position: 42 } });
  });
});
