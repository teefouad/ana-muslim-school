import { describe, expect, it } from "vitest";

import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { Module } from "@/lib/modules/types";
import {
  createEmptyModuleFieldsValues,
  toMaterialContent,
  toModuleCreateFields,
  toModuleFieldsValues,
  toModulePatchFields,
} from "./module-fields";

function buildModuleFixture(overrides: Partial<Module> = {}): Module {
  return {
    id: "module-1",
    title: { ar: "", en: "" },
    description: { ar: "", en: "" },
    color: "",
    lessons: [],
    isLocked: false,
    isPublished: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
    ...overrides,
  };
}

describe("createEmptyModuleFieldsValues", () => {
  it("starts every field blank, with the default application color and Published off", () => {
    expect(createEmptyModuleFieldsValues()).toEqual({
      title: {},
      description: {},
      color: DEFAULT_APPLICATION_COLOR,
      content: {},
      isPublished: false,
    });
  });
});

describe("toModuleFieldsValues", () => {
  it("maps the Module's own title/description/color/isPublished", () => {
    const fields = toModuleFieldsValues(
      buildModuleFixture({
        title: { ar: "أ", en: "A" },
        description: { ar: "وصف", en: "Desc" },
        color: "cyan.6",
        isPublished: true,
      }),
    );

    expect(fields.title).toEqual({ ar: "أ", en: "A" });
    expect(fields.description).toEqual({ ar: "وصف", en: "Desc" });
    expect(fields.color).toBe("cyan.6");
    expect(fields.isPublished).toBe(true);
  });

  it("seeds content from a given Learning Material content (ANA-94 PR review)", () => {
    const fields = toModuleFieldsValues(buildModuleFixture(), {
      ar: "محتوى",
      en: "Content",
    });

    expect(fields.content).toEqual({ ar: "محتوى", en: "Content" });
  });

  it("defaults content to blank when no Material content is given", () => {
    const fields = toModuleFieldsValues(buildModuleFixture());

    expect(fields.content).toEqual({});
  });
});

describe("toModuleCreateFields", () => {
  it("normalizes title/description to { ar, en } pairs, sends the entered isPublished, defaults isLocked to false, and never includes content", () => {
    const result = toModuleCreateFields({
      title: { ar: "أ" },
      description: {},
      color: "pink.6",
      content: { ar: "محتوى", en: "Content" },
      isPublished: true,
    });

    expect(result).toEqual({
      title: { ar: "أ", en: "" },
      description: { ar: "", en: "" },
      color: "pink.6",
      isLocked: false,
      isPublished: true,
    });
    expect(result).not.toHaveProperty("content");
  });
});

describe("toModulePatchFields", () => {
  it("normalizes title/description, sends the entered isPublished, never includes isLocked/content", () => {
    const result = toModulePatchFields({
      title: { en: "A" },
      description: { ar: "وصف" },
      color: "cyan.6",
      content: { ar: "محتوى", en: "" },
      isPublished: true,
    });

    expect(result).toEqual({
      title: { ar: "", en: "A" },
      description: { ar: "وصف", en: "" },
      color: "cyan.6",
      isPublished: true,
    });
    expect(result).not.toHaveProperty("isLocked");
    expect(result).not.toHaveProperty("content");
  });
});

describe("toMaterialContent", () => {
  it("normalizes the fields' content to a { ar, en } pair for the Material APIs", () => {
    expect(
      toMaterialContent({
        title: {},
        description: {},
        color: "",
        content: { ar: "محتوى" },
        isPublished: false,
      }),
    ).toEqual({ ar: "محتوى", en: "" });
  });
});
