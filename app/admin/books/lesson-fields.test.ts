import { describe, expect, it } from "vitest";

import { createEmptyLessonFieldsValues } from "./lesson-fields";

describe("createEmptyLessonFieldsValues", () => {
  it("defaults a new Lesson's type to Quiz, not Text (ANA-127)", () => {
    const values = createEmptyLessonFieldsValues();

    expect(values.type).toBe("quiz");
  });
});
