export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** The fixed prefix shared by every endpoint in the registry. */
export const API_BASE_PATH = "/api/v1";

/**
 * A selectable endpoint in the API Playground (see ANA-55). This registry
 * only describes the playground's UI needs (method, path, params, whether a
 * body/auth applies) -- it mirrors the real `/api/v1` route handlers but is
 * not itself a source of truth for API business logic.
 */
export type ApiEndpoint = {
  /** Stable key used to identify the endpoint in the playground's UI state. */
  id: string;
  method: HttpMethod;
  /** Route path with `:param` placeholders for required path parameters. */
  path: string;
  pathParams: string[];
  /** Optional query parameters the endpoint accepts, e.g. `["limit"]`. */
  queryParams: string[];
  acceptsBody: boolean;
  authRequired: boolean;
  description: string;
};

/** Every endpoint the API Playground can send requests to. */
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "permissions.list",
    method: "GET",
    path: "/api/v1/permissions",
    pathParams: [],
    queryParams: [],
    acceptsBody: false,
    authRequired: true,
    description: "List all permission records.",
  },
  {
    id: "permissions.create",
    method: "POST",
    path: "/api/v1/permissions",
    pathParams: [],
    queryParams: [],
    acceptsBody: true,
    authRequired: true,
    description: "Create a new permission record.",
  },
  {
    id: "permissions.get",
    method: "GET",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    queryParams: [],
    acceptsBody: false,
    authRequired: true,
    description: "Get a single permission record by id.",
  },
  {
    id: "permissions.update",
    method: "PATCH",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    queryParams: [],
    acceptsBody: true,
    authRequired: true,
    description: "Update the permissions/expiration on a record.",
  },
  {
    id: "permissions.delete",
    method: "DELETE",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    queryParams: [],
    acceptsBody: false,
    authRequired: true,
    description: "Delete a permission record.",
  },
];

/**
 * Substitutes each of `endpoint`'s `:param` placeholders with the matching
 * value from `paramValues`, URI-encoding each value so entered parameters
 * can't reshape the request path (e.g. a value containing `/` or `?`).
 *
 * Matches a placeholder only when it fills an entire path segment (e.g.
 * `:id`) rather than via a plain string replace -- that would only touch
 * the first occurrence and could also match `:id` inside an unrelated
 * placeholder like `:id2`.
 */
export function buildRequestPath(
  endpoint: ApiEndpoint,
  paramValues: Record<string, string>,
): string {
  return endpoint.path
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) {
        return segment;
      }

      const param = segment.slice(1);
      return encodeURIComponent(paramValues[param] ?? "");
    })
    .join("/");
}

/**
 * Builds a `?key=value&...` query string from `endpoint`'s declared query
 * parameters, omitting any left blank. Returns `""` when there are none to
 * include.
 */
export function buildQueryString(
  endpoint: ApiEndpoint,
  queryParamValues: Record<string, string>,
): string {
  const params = new URLSearchParams();

  for (const param of endpoint.queryParams) {
    const value = queryParamValues[param]?.trim();

    if (value) {
      params.set(param, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

/** The full request URL for `endpoint`: its path with parameters substituted, plus any query string. */
export function buildRequestUrl(
  endpoint: ApiEndpoint,
  pathParamValues: Record<string, string>,
  queryParamValues: Record<string, string>,
): string {
  return (
    buildRequestPath(endpoint, pathParamValues) +
    buildQueryString(endpoint, queryParamValues)
  );
}

/** `endpoint.path` with the shared `API_BASE_PATH` prefix stripped, e.g. `/permissions/:id`. */
export function getResourcePath(endpoint: ApiEndpoint): string {
  return endpoint.path.slice(API_BASE_PATH.length);
}

/** Every distinct resource path in the registry, in declaration order. */
export function getResourcePaths(): string[] {
  return Array.from(new Set(API_ENDPOINTS.map(getResourcePath)));
}

/** The HTTP methods the registry exposes for a given resource path, in declaration order. */
export function getMethodsForResource(resourcePath: string): HttpMethod[] {
  return API_ENDPOINTS.filter(
    (endpoint) => getResourcePath(endpoint) === resourcePath,
  ).map((endpoint) => endpoint.method);
}

/** Looks up the registry entry for a given method + resource path combination. */
export function findEndpoint(
  method: HttpMethod,
  resourcePath: string,
): ApiEndpoint | undefined {
  return API_ENDPOINTS.find(
    (endpoint) =>
      endpoint.method === method && getResourcePath(endpoint) === resourcePath,
  );
}
