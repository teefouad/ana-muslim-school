import { describe, expect, it } from "vitest";

import {
  API_ENDPOINTS,
  buildRequestPath,
  formatEndpointLabel,
  type ApiEndpoint,
} from "./endpoint-registry";

describe("API_ENDPOINTS", () => {
  it("has a unique id for every endpoint", () => {
    const ids = API_ENDPOINTS.map((endpoint) => endpoint.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists a `:param` placeholder in the path for every declared pathParam", () => {
    for (const endpoint of API_ENDPOINTS) {
      for (const param of endpoint.pathParams) {
        expect(endpoint.path).toContain(`:${param}`);
      }
    }
  });
});

describe("buildRequestPath", () => {
  const endpoint: ApiEndpoint = {
    id: "permissions.update",
    method: "PATCH",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    acceptsBody: true,
    authRequired: true,
    description: "Update the permissions/expiration on a record.",
  };

  it("substitutes a path parameter with its given value", () => {
    expect(buildRequestPath(endpoint, { id: "doc-42" })).toBe(
      "/api/v1/permissions/doc-42",
    );
  });

  it("URI-encodes a parameter value so it can't reshape the request path", () => {
    expect(buildRequestPath(endpoint, { id: "doc/42?x=1" })).toBe(
      "/api/v1/permissions/doc%2F42%3Fx%3D1",
    );
  });

  it("substitutes every occurrence of a placeholder without matching a differently-named one that shares its prefix", () => {
    const multiParamEndpoint: ApiEndpoint = {
      id: "example.multi",
      method: "GET",
      path: "/api/v1/example/:id/:id2/:id",
      pathParams: ["id", "id2"],
      acceptsBody: false,
      authRequired: true,
      description: "Example endpoint with repeated and prefix-sharing params.",
    };

    expect(buildRequestPath(multiParamEndpoint, { id: "a", id2: "b" })).toBe(
      "/api/v1/example/a/b/a",
    );
  });

  it("leaves the path untouched when the endpoint has no path parameters", () => {
    const listEndpoint: ApiEndpoint = {
      id: "permissions.list",
      method: "GET",
      path: "/api/v1/permissions",
      pathParams: [],
      acceptsBody: false,
      authRequired: true,
      description: "List all permission records.",
    };

    expect(buildRequestPath(listEndpoint, {})).toBe("/api/v1/permissions");
  });
});

describe("formatEndpointLabel", () => {
  it("joins the method and path", () => {
    expect(
      formatEndpointLabel({
        id: "permissions.list",
        method: "GET",
        path: "/api/v1/permissions",
        pathParams: [],
        acceptsBody: false,
        authRequired: true,
        description: "List all permission records.",
      }),
    ).toBe("GET /api/v1/permissions");
  });
});
