"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  useComputedColorScheme,
} from "@mantine/core";
import { JsonView, darkStyles, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

import {
  API_BASE_PATH,
  buildRequestPath,
  findEndpoint,
  getMethodsForResource,
  getResourcePath,
  getResourcePaths,
  type ApiEndpoint,
  type HttpMethod,
} from "@/lib/api-playground/endpoint-registry";

type JsonValue = Record<string, unknown> | unknown[];

type PlaygroundResponse = {
  status: number;
  statusText: string;
  /** The response body exactly as the endpoint returned it, unmodified. */
  raw: string;
  /** Set only when `raw` parses as a JSON object/array, for the tree viewer. */
  json: JsonValue | undefined;
};

const DEFAULT_ENDPOINT: ApiEndpoint | undefined = findEndpoint(
  getMethodsForResource(getResourcePaths()[0] ?? "")[0] ?? "GET",
  getResourcePaths()[0] ?? "",
);

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function ApiPlayground() {
  const colorScheme = useComputedColorScheme("dark");
  const [resourcePath, setResourcePath] = useState(
    DEFAULT_ENDPOINT ? getResourcePath(DEFAULT_ENDPOINT) : "",
  );
  const [method, setMethod] = useState<HttpMethod>(
    DEFAULT_ENDPOINT?.method ?? "GET",
  );
  const [pathParamValues, setPathParamValues] = useState<
    Record<string, string>
  >({});
  const [authEnabled, setAuthEnabled] = useState(true);
  const [bodyText, setBodyText] = useState("{}");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);

  const endpoint = findEndpoint(method, resourcePath);
  const resourceOptions = getResourcePaths();
  const methodOptions = getMethodsForResource(resourcePath);

  function handleResourceChange(newResourcePath: string) {
    const methodsForNewResource = getMethodsForResource(newResourcePath);
    const newMethod = methodsForNewResource.includes(method)
      ? method
      : (methodsForNewResource[0] ?? method);

    setResourcePath(newResourcePath);
    setMethod(newMethod);
    setPathParamValues({});
    setBodyText("{}");
    setBodyError(null);
    setRequestError(null);
    setResponse(null);
  }

  function handleMethodChange(newMethod: HttpMethod) {
    // The resource (and therefore its path parameters) is unchanged, so
    // path parameter values and the body draft are kept -- switching from
    // GET to PATCH on the same resource shouldn't lose an already-entered
    // id.
    setMethod(newMethod);
    setBodyError(null);
    setRequestError(null);
    setResponse(null);
  }

  function handlePathParamChange(param: string, value: string) {
    setPathParamValues((prev) => ({ ...prev, [param]: value }));
  }

  async function handleSend() {
    if (!endpoint) {
      return;
    }

    setRequestError(null);
    setBodyError(null);

    const missingParam = endpoint.pathParams.find(
      (param) => !pathParamValues[param]?.trim(),
    );

    if (missingParam) {
      setRequestError("All path parameters are required.");
      return;
    }

    if (endpoint.acceptsBody) {
      try {
        JSON.parse(bodyText);
      } catch {
        setBodyError("Enter valid JSON.");
        return;
      }
    }

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(buildRequestPath(endpoint, pathParamValues), {
        method: endpoint.method,
        headers: endpoint.acceptsBody
          ? { "Content-Type": "application/json" }
          : undefined,
        body: endpoint.acceptsBody ? bodyText : undefined,
        // Authenticated mode relies on the browser sending the existing
        // dashboard session cookie as it normally would; unauthenticated
        // mode omits it so the endpoint's real unauthenticated behavior can
        // be exercised, without ever reading or displaying the cookie value.
        credentials: authEnabled ? "same-origin" : "omit",
      });
      const text = await res.text();
      let json: JsonValue | undefined;

      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed !== null && typeof parsed === "object") {
          json = parsed as JsonValue;
        }
      } catch {
        json = undefined;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        raw: text,
        json,
      });
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "The request failed to send.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group align="flex-end" gap="xs">
            <NativeSelect
              label="Method"
              data={methodOptions}
              value={method}
              onChange={(event) =>
                handleMethodChange(event.currentTarget.value as HttpMethod)
              }
              disabled={loading}
            />
            <Text
              size="sm"
              c="dimmed"
              pb={8}
              style={{ fontFamily: "monospace" }}
            >
              {API_BASE_PATH}
            </Text>
            <NativeSelect
              label="Resource"
              data={resourceOptions}
              value={resourcePath}
              onChange={(event) =>
                handleResourceChange(event.currentTarget.value)
              }
              disabled={loading}
              flex={1}
            />
          </Group>

          {endpoint && endpoint.pathParams.length > 0 && (
            <Group grow>
              {endpoint.pathParams.map((param) => (
                <TextInput
                  key={param}
                  label={`Path parameter: ${param}`}
                  value={pathParamValues[param] ?? ""}
                  onChange={(event) =>
                    handlePathParamChange(param, event.currentTarget.value)
                  }
                  required
                />
              ))}
            </Group>
          )}

          {endpoint && (
            <Text size="sm" c="dimmed">
              Request URL:{" "}
              <Code>
                {endpoint.method} {buildRequestPath(endpoint, pathParamValues)}
              </Code>
            </Text>
          )}

          <Switch
            label="Include authentication"
            description={
              authEnabled
                ? "Sends the request using your current dashboard session."
                : "Sends the request without your dashboard session, to test unauthenticated behavior."
            }
            checked={authEnabled}
            onChange={(event) => setAuthEnabled(event.currentTarget.checked)}
          />

          {endpoint?.acceptsBody ? (
            <Textarea
              label="Request body (JSON)"
              value={bodyText}
              onChange={(event) => {
                setBodyText(event.currentTarget.value);
                setBodyError(null);
              }}
              error={bodyError}
              minRows={8}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          ) : (
            endpoint && (
              <Text size="sm" c="dimmed">
                This endpoint does not accept a request body.
              </Text>
            )
          )}

          {requestError && <Alert color="red">{requestError}</Alert>}

          <Group justify="flex-end">
            <Button onClick={handleSend} loading={loading} disabled={!endpoint}>
              Send request
            </Button>
          </Group>
        </Stack>
      </Paper>

      {response && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Group gap="sm">
              <Badge color={isSuccessStatus(response.status) ? "green" : "red"}>
                {response.status}
              </Badge>
              <Text fw={500}>{response.statusText}</Text>
            </Group>
            {response.json !== undefined ? (
              <JsonView
                data={response.json}
                style={colorScheme === "dark" ? darkStyles : defaultStyles}
              />
            ) : (
              <Code block>{response.raw}</Code>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
