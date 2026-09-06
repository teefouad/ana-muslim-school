"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
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
  Tooltip,
} from "@mantine/core";
import { Check, ChevronsDownUp, ChevronsUpDown, Copy } from "lucide-react";
import ReactJson from "@microlink/react-json-view";

import {
  API_BASE_PATH,
  buildRequestUrl,
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
  const [resourcePath, setResourcePath] = useState(
    DEFAULT_ENDPOINT ? getResourcePath(DEFAULT_ENDPOINT) : "",
  );
  const [method, setMethod] = useState<HttpMethod>(
    DEFAULT_ENDPOINT?.method ?? "GET",
  );
  const [pathParamValues, setPathParamValues] = useState<
    Record<string, string>
  >({});
  const [queryParamValues, setQueryParamValues] = useState<
    Record<string, string>
  >({});
  const [authEnabled, setAuthEnabled] = useState(true);
  const [bodyText, setBodyText] = useState("{}");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [treeExpanded, setTreeExpanded] = useState(true);
  // ReactJsonView only applies its `collapsed` prop when it (re)mounts, not
  // on every prop update -- bumped whenever the desired expand/collapse
  // state should be re-applied (Expand/Collapse all, or a new response) so
  // changing `key` below forces that remount.
  const [treeVersion, setTreeVersion] = useState(0);
  const [copied, setCopied] = useState(false);

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
    setQueryParamValues({});
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

  function handleQueryParamChange(param: string, value: string) {
    setQueryParamValues((prev) => ({ ...prev, [param]: value }));
  }

  async function handleCopy() {
    if (!response) {
      return;
    }

    try {
      await navigator.clipboard.writeText(response.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser -- there's nothing
      // more the playground can do about it.
    }
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
      const res = await fetch(
        buildRequestUrl(endpoint, pathParamValues, queryParamValues),
        {
          method: endpoint.method,
          headers: endpoint.acceptsBody
            ? { "Content-Type": "application/json" }
            : undefined,
          body: endpoint.acceptsBody ? bodyText : undefined,
          // Authenticated mode relies on the browser sending the existing
          // dashboard session cookie as it normally would; unauthenticated
          // mode omits it so the endpoint's real unauthenticated behavior
          // can be exercised, without ever reading or displaying the
          // cookie value.
          credentials: authEnabled ? "same-origin" : "omit",
        },
      );
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
      setTreeExpanded(true);
      setTreeVersion((version) => version + 1);
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
              w={100}
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

          {endpoint && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                Authentication:
              </Text>
              <Badge
                color={endpoint.authRequired ? "yellow" : "gray"}
                variant="light"
                size="sm"
              >
                {endpoint.authRequired ? "Required" : "Not required"}
              </Badge>
            </Group>
          )}

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

          {endpoint && endpoint.queryParams.length > 0 && (
            <Group grow>
              {endpoint.queryParams.map((param) => (
                <TextInput
                  key={param}
                  label={`Query parameter: ${param}`}
                  description="Optional"
                  value={queryParamValues[param] ?? ""}
                  onChange={(event) =>
                    handleQueryParamChange(param, event.currentTarget.value)
                  }
                />
              ))}
            </Group>
          )}

          {endpoint && (
            <Text size="sm" c="dimmed">
              Request URL:{" "}
              <Code>
                {endpoint.method}{" "}
                {buildRequestUrl(endpoint, pathParamValues, queryParamValues)}
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
            <Group justify="space-between">
              <Group gap="sm">
                <Badge
                  color={isSuccessStatus(response.status) ? "green" : "red"}
                >
                  {response.status}
                </Badge>
                <Text fw={500}>{response.statusText}</Text>
              </Group>
              <Group gap={4}>
                <Tooltip label="Expand all">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Expand all"
                    disabled={response.json === undefined}
                    onClick={() => {
                      setTreeExpanded(true);
                      setTreeVersion((version) => version + 1);
                    }}
                  >
                    <ChevronsUpDown size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Collapse all">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Collapse all"
                    disabled={response.json === undefined}
                    onClick={() => {
                      setTreeExpanded(false);
                      setTreeVersion((version) => version + 1);
                    }}
                  >
                    <ChevronsDownUp size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={copied ? "Copied!" : "Copy response"}>
                  <ActionIcon
                    variant="subtle"
                    aria-label="Copy response"
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Box style={{ maxHeight: 480, overflow: "auto" }}>
              {response.json !== undefined ? (
                <ReactJson
                  key={treeVersion}
                  src={response.json}
                  name={false}
                  theme="monokai"
                  displayDataTypes={false}
                  collapsed={!treeExpanded}
                />
              ) : (
                <Code block>{response.raw}</Code>
              )}
            </Box>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
