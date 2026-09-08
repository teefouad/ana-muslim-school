import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ai-client", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("can be imported without OPENAI_API_KEY set", async () => {
    await expect(import("./ai-client")).resolves.toBeDefined();
  });

  it("throws only once the client is actually requested", async () => {
    const { getOpenAiClient } = await import("./ai-client");

    expect(() => getOpenAiClient()).toThrow(/OPENAI_API_KEY/);
  });

  it("constructs the client once OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const { getOpenAiClient } = await import("./ai-client");

    expect(() => getOpenAiClient()).not.toThrow();
  });
});
