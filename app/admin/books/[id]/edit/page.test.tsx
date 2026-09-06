import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

const { useRouterMock, useParamsMock, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  return {
    useRouterMock: vi.fn(() => ({ push: pushMock })),
    useParamsMock: vi.fn(),
    pushMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
  useParams: useParamsMock,
}));

import { buildBookFixture } from "../../book-fixtures";
import EditBookPage from "./page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak fixture data across test cases keyed by the same URL. */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EditBookPage />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("EditBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    useParamsMock.mockReturnValue({ id: "book-1" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads with GET /api/v1/books/{bookId}", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1");
  });

  it("has no Cancel button", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();
    await screen.findByRole("button", { name: "Save changes" });

    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("initializes every Book field correctly, including longDescription", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: buildBookFixture({
          longDescription: { ar: "# طويل", en: "# Long" },
        }),
      }),
    );
    renderPage();

    expect(
      await screen.findByDisplayValue("الرحيق المختوم"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toHaveValue(
      "sealed-nectar",
    );
    expect(screen.getByRole("switch", { name: "Published" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      await screen.findByRole("heading", { name: "طويل" }),
    ).toBeInTheDocument();
  });

  it("renders Import Source immediately next to Save changes in the header, both enabled once loaded", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();

    const saveChanges = await screen.findByRole("button", {
      name: "Save changes",
    });
    const importSource = screen.getByRole("button", { name: "Import Source" });
    expect(importSource).toBeEnabled();
    expect(saveChanges).toBeEnabled();

    // "Immediately next to" -- adjacent header buttons in the same action
    // group, not separated by unrelated content.
    expect(importSource.nextElementSibling).toBe(saveChanges);
  });

  it("renders the Sections panel on the right, enabled", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();

    await screen.findByRole("button", { name: "Save changes" });
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add section" })).toBeEnabled();
  });

  it("sends PATCH /api/v1/books/{bookId} with the edited fields on save, without modules or audit fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();

    await screen.findByRole("button", { name: "Save changes" });

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ data: buildBookFixture({ imageId: "updated-image" }) }),
    );

    fireEvent.change(screen.getByLabelText("In-app image ID"), {
      target: { value: "updated-image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/admin/books"),
    );

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(url).toBe("/api/v1/books/book-1");
    expect(init.method).toBe("PATCH");

    const body = JSON.parse(init.body as string);
    expect(body.imageId).toBe("updated-image");
    expect(body).not.toHaveProperty("modules");
    expect(body).not.toHaveProperty("createdAt");
    expect(body).not.toHaveProperty("updatedAt");
    expect(body).not.toHaveProperty("createdBy");
    expect(body).not.toHaveProperty("updatedBy");
  });

  it("stays on the form and surfaces the failure when saving fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ data: buildBookFixture() }),
    );
    renderPage();
    await screen.findByRole("button", { name: "Save changes" });

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ error: "Something went wrong." }, 400),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a not-found state for a 404, rather than falling back to mock data", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Book not found." }, 404),
    );
    renderPage();

    expect(
      await screen.findByText("This book could not be found."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("In-app image ID")).not.toBeInTheDocument();
  });
});
