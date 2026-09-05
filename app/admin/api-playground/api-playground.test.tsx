import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiPlayground } from "./api-playground";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function selectResource(resourcePath: string) {
  fireEvent.change(screen.getByLabelText("Resource"), {
    target: { value: resourcePath },
  });
}

function selectMethod(method: string) {
  fireEvent.change(screen.getByLabelText("Method"), {
    target: { value: method },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("ApiPlayground", () => {
  it("defaults to the first registered endpoint with no request body editor", () => {
    renderWithProvider(<ApiPlayground />);

    expect(screen.getByLabelText("Method")).toHaveValue("GET");
    expect(screen.getByLabelText("Resource")).toHaveValue("/permissions");
    expect(
      screen.getByText("This endpoint does not accept a request body."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Request body (JSON)"),
    ).not.toBeInTheDocument();
  });

  it("switches resources and shows path parameter inputs when the resource has them", () => {
    renderWithProvider(<ApiPlayground />);

    selectResource("/permissions/:id");

    expect(screen.getByLabelText("Method")).toHaveValue("GET");
    expect(screen.getByLabelText(/Path parameter: id/)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Request body (JSON)"),
    ).not.toBeInTheDocument();
  });

  it("only offers methods the registry declares for the selected resource", () => {
    renderWithProvider(<ApiPlayground />);

    const methodSelect = screen.getByLabelText("Method") as HTMLSelectElement;
    const optionValues = Array.from(methodSelect.options).map(
      (option) => option.value,
    );

    expect(optionValues).toEqual(["GET", "POST"]);

    selectResource("/permissions/:id");

    expect(
      Array.from(methodSelect.options).map((option) => option.value),
    ).toEqual(["GET", "PATCH", "DELETE"]);
  });

  it("auto-corrects the method when switching to a resource that doesn't support the current one", () => {
    renderWithProvider(<ApiPlayground />);

    selectMethod("POST");
    expect(screen.getByLabelText("Method")).toHaveValue("POST");

    selectResource("/permissions/:id");

    expect(screen.getByLabelText("Method")).toHaveValue("GET");
  });

  it("preserves an entered path parameter when switching methods on the same resource", () => {
    renderWithProvider(<ApiPlayground />);
    selectResource("/permissions/:id");

    fireEvent.change(screen.getByLabelText(/Path parameter: id/), {
      target: { value: "doc-42" },
    });

    selectMethod("PATCH");

    expect(screen.getByLabelText(/Path parameter: id/)).toHaveValue("doc-42");
    expect(screen.getByLabelText("Request body (JSON)")).toBeInTheDocument();
  });

  it("shows a JSON body editor for endpoints that accept a body", () => {
    renderWithProvider(<ApiPlayground />);

    selectMethod("POST");

    expect(screen.getByLabelText("Request body (JSON)")).toBeInTheDocument();
    expect(
      screen.queryByText("This endpoint does not accept a request body."),
    ).not.toBeInTheDocument();
  });

  it("substitutes an entered path parameter into the request URL and the sent request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );

    renderWithProvider(<ApiPlayground />);
    selectResource("/permissions/:id");

    fireEvent.change(screen.getByLabelText(/Path parameter: id/), {
      target: { value: "doc-42" },
    });

    expect(
      screen.getByText("GET /api/v1/permissions/doc-42"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/permissions/doc-42",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not send a request when a required path parameter is left blank", () => {
    renderWithProvider(<ApiPlayground />);
    selectResource("/permissions/:id");

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByText("All path parameters are required."),
    ).toBeInTheDocument();
  });

  it("sends the request with the current session (default) when authentication is enabled", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/permissions",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("omits the dashboard session when authentication is disabled", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(
      screen.getByLabelText("Include authentication", { exact: false }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/permissions",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("sends a valid JSON body with a POST and the JSON content type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    renderWithProvider(<ApiPlayground />);
    selectMethod("POST");

    fireEvent.change(screen.getByLabelText("Request body (JSON)"), {
      target: { value: '{"email":"someone@example.com"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/permissions",
      expect.objectContaining({
        method: "POST",
        body: '{"email":"someone@example.com"}',
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("blocks submission and shows an error for invalid JSON, without sending a request", () => {
    renderWithProvider(<ApiPlayground />);
    selectMethod("POST");

    fireEvent.change(screen.getByLabelText("Request body (JSON)"), {
      target: { value: "{not valid json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Enter valid JSON.")).toBeInTheDocument();
  });

  it("displays the response status code and a colored, collapsible JSON tree", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "doc-1" } }), {
        status: 201,
        statusText: "Created",
      }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("201")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(screen.getByText("id:")).toBeInTheDocument();
    expect(screen.getByText('"doc-1"')).toBeInTheDocument();
  });

  it("displays a non-JSON response body as plain text instead of failing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Something went wrong upstream.", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("500")).toBeInTheDocument();
    expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong upstream."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeDisabled();
  });

  it("collapses and re-expands the JSON tree via the toolbar", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "doc-1" } }), {
        status: 200,
      }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText('"doc-1"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText('"doc-1"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText('"doc-1"')).toBeInTheDocument();
  });

  it("starts each new response fully expanded even if the previous one was collapsed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "doc-1" } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "doc-2" } }), {
          status: 200,
        }),
      );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByText('"doc-1"');

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText('"doc-1"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText('"doc-2"')).toBeInTheDocument();
  });

  it("copies the raw response body to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByText("200");

    fireEvent.click(screen.getByRole("button", { name: "Copy response" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(JSON.stringify({ data: [] })),
    );
  });

  it("shows a loading state and disables the Send button while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();

    resolveFetch(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send request" }),
      ).not.toBeDisabled(),
    );
  });

  it("locks the method and resource pickers while a request is in flight, so switching them can't mismatch an in-flight response", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderWithProvider(<ApiPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByLabelText("Method")).toBeDisabled();
    expect(screen.getByLabelText("Resource")).toBeDisabled();

    resolveFetch(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await waitFor(() =>
      expect(screen.getByLabelText("Method")).not.toBeDisabled(),
    );
    expect(screen.getByLabelText("Resource")).not.toBeDisabled();
  });
});
