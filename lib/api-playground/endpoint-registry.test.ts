import { describe, expect, it } from "vitest";

import {
  API_ENDPOINTS,
  buildQueryString,
  buildRequestPath,
  buildRequestUrl,
  findEndpoint,
  getMethodsForResource,
  getResourcePath,
  getResourcePaths,
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
    queryParams: [],
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
      queryParams: [],
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
      queryParams: [],
      acceptsBody: false,
      authRequired: true,
      description: "List all permission records.",
    };

    expect(buildRequestPath(listEndpoint, {})).toBe("/api/v1/permissions");
  });
});

describe("getResourcePath", () => {
  it("strips the shared /api/v1 prefix", () => {
    expect(
      getResourcePath({
        id: "permissions.get",
        method: "GET",
        path: "/api/v1/permissions/:id",
        pathParams: ["id"],
        queryParams: [],
        acceptsBody: false,
        authRequired: true,
        description: "Get a single permission record by id.",
      }),
    ).toBe("/permissions/:id");
  });
});

describe("getResourcePaths", () => {
  it("lists every distinct resource path in the registry exactly once", () => {
    expect(getResourcePaths()).toEqual([
      "/permissions",
      "/permissions/:id",
      "/sources",
      "/sources/:id",
      "/materials",
      "/materials/:id",
      "/books",
      "/books/:bookId",
      "/books/:bookId/modules",
      "/books/:bookId/modules/:moduleId",
      "/books/:bookId/modules/:moduleId/lessons",
      "/books/:bookId/modules/:moduleId/lessons/:lessonId",
      "/books/:bookId/modules/:moduleId/questions",
      "/books/:bookId/modules/:moduleId/questions/:questionId",
    ]);
  });
});

describe("getMethodsForResource", () => {
  it("lists only the methods the registry declares for that resource", () => {
    expect(getMethodsForResource("/permissions")).toEqual(["GET", "POST"]);
    expect(getMethodsForResource("/permissions/:id")).toEqual([
      "GET",
      "PATCH",
      "DELETE",
    ]);
  });

  it("returns an empty list for a resource the registry doesn't have", () => {
    expect(getMethodsForResource("/nonexistent")).toEqual([]);
  });
});

describe("buildQueryString", () => {
  const endpoint: ApiEndpoint = {
    id: "example.search",
    method: "GET",
    path: "/api/v1/example",
    pathParams: [],
    queryParams: ["limit", "cursor"],
    acceptsBody: false,
    authRequired: true,
    description: "Example endpoint with query parameters.",
  };

  it("builds a query string from the given values", () => {
    expect(buildQueryString(endpoint, { limit: "10", cursor: "abc" })).toBe(
      "?limit=10&cursor=abc",
    );
  });

  it("omits a query parameter left blank", () => {
    expect(buildQueryString(endpoint, { limit: "10", cursor: "" })).toBe(
      "?limit=10",
    );
  });

  it("returns an empty string when every query parameter is blank", () => {
    expect(buildQueryString(endpoint, {})).toBe("");
  });

  it("returns an empty string for an endpoint with no query parameters", () => {
    const noQueryEndpoint: ApiEndpoint = {
      id: "permissions.list",
      method: "GET",
      path: "/api/v1/permissions",
      pathParams: [],
      queryParams: [],
      acceptsBody: false,
      authRequired: true,
      description: "List all permission records.",
    };

    expect(buildQueryString(noQueryEndpoint, { limit: "10" })).toBe("");
  });
});

describe("buildRequestUrl", () => {
  it("combines the substituted path and the query string", () => {
    const endpoint: ApiEndpoint = {
      id: "example.search",
      method: "GET",
      path: "/api/v1/example/:id",
      pathParams: ["id"],
      queryParams: ["limit"],
      acceptsBody: false,
      authRequired: true,
      description: "Example endpoint with a path and a query parameter.",
    };

    expect(buildRequestUrl(endpoint, { id: "doc-1" }, { limit: "5" })).toBe(
      "/api/v1/example/doc-1?limit=5",
    );
  });
});

describe("findEndpoint", () => {
  it("finds the registry entry matching a method and resource path", () => {
    expect(findEndpoint("PATCH", "/permissions/:id")).toMatchObject({
      id: "permissions.update",
    });
  });

  it("returns undefined for a method/resource combination the registry doesn't have", () => {
    expect(findEndpoint("DELETE", "/permissions")).toBeUndefined();
  });
});
