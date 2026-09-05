export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

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
    acceptsBody: false,
    authRequired: true,
    description: "List all permission records.",
  },
  {
    id: "permissions.create",
    method: "POST",
    path: "/api/v1/permissions",
    pathParams: [],
    acceptsBody: true,
    authRequired: true,
    description: "Create a new permission record.",
  },
  {
    id: "permissions.get",
    method: "GET",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    acceptsBody: false,
    authRequired: true,
    description: "Get a single permission record by id.",
  },
  {
    id: "permissions.update",
    method: "PATCH",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
    acceptsBody: true,
    authRequired: true,
    description: "Update the permissions/expiration on a record.",
  },
  {
    id: "permissions.delete",
    method: "DELETE",
    path: "/api/v1/permissions/:id",
    pathParams: ["id"],
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

/** Human-readable "METHOD /path" label for an endpoint picker option. */
export function formatEndpointLabel(endpoint: ApiEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}
