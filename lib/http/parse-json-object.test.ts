import { describe, expect, it } from "vitest";

import { parseJsonObject } from "./parse-json-object";

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/example", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("parseJsonObject", () => {
  it("parses a well-formed JSON object", async () => {
    const result = await parseJsonObject(rawRequest('{"a":1}'));

    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects malformed JSON", async () => {
    const result = await parseJsonObject(rawRequest("{not valid json"));

    expect(result).toEqual({ ok: false });
  });

  it("rejects a JSON array", async () => {
    const result = await parseJsonObject(rawRequest("[1,2,3]"));

    expect(result).toEqual({ ok: false });
  });

  it("rejects a bare JSON value (string/number)", async () => {
    expect(await parseJsonObject(rawRequest('"just a string"'))).toEqual({
      ok: false,
    });
    expect(await parseJsonObject(rawRequest("42"))).toEqual({ ok: false });
  });

  it("rejects a null JSON body", async () => {
    const result = await parseJsonObject(rawRequest("null"));

    expect(result).toEqual({ ok: false });
  });
});
