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
} from "@mantine/core";

import {
  API_ENDPOINTS,
  buildRequestPath,
  formatEndpointLabel,
  type ApiEndpoint,
} from "@/lib/api-playground/endpoint-registry";

type PlaygroundResponse = {
  status: number;
  statusText: string;
  bodyText: string;
};

function findEndpoint(id: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((endpoint) => endpoint.id === id);
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Formats a response body for display: JSON is re-serialized with
 * indentation for readability, anything else -- including a genuinely empty
 * body -- is shown exactly as received so the playground never rewrites
 * what the endpoint actually returned (see ANA-55).
 */
function formatResponseBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function ApiPlayground() {
  const [endpointId, setEndpointId] = useState(API_ENDPOINTS[0]?.id ?? "");
  const [pathParamValues, setPathParamValues] = useState<
    Record<string, string>
  >({});
  const [authEnabled, setAuthEnabled] = useState(true);
  const [bodyText, setBodyText] = useState("{}");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);

  const endpoint = findEndpoint(endpointId);

  function handleEndpointChange(id: string) {
    setEndpointId(id);
    setPathParamValues({});
    setBodyText("{}");
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

      setResponse({
        status: res.status,
        statusText: res.statusText,
        bodyText: formatResponseBody(text),
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
          <NativeSelect
            label="Endpoint"
            data={API_ENDPOINTS.map((item) => ({
              value: item.id,
              label: formatEndpointLabel(item),
            }))}
            value={endpointId}
            onChange={(event) =>
              handleEndpointChange(event.currentTarget.value)
            }
            disabled={loading}
          />

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
            <Code block>{response.bodyText}</Code>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
