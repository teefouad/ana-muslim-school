import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRouterMock, replaceMock } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return {
    useRouterMock: vi.fn(() => ({ replace: replaceMock })),
    replaceMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import { buildBookFixture } from "../book-fixtures";
import AddBookPage from "./page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  return render(
    <MantineProvider>
      <AddBookPage />
    </MantineProvider>,
  );
}

describe("AddBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ replace: replaceMock });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("has no Cancel button", () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("contains exactly the requested Book form fields", () => {
    renderPage();

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Long description")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Locked" })).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
  });

  it("renders Add book as a page header action that submits the Book form", () => {
    renderPage();

    const addButton = screen.getByRole("button", { name: "Add book" });
    expect(addButton).toHaveAttribute("type", "submit");
    expect(addButton).toHaveAttribute("form");
  });

  it("does not render an Import Modules action", () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Import Modules" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create from PDF" }),
    ).not.toBeInTheDocument();
  });

  it("renders the Modules panel disabled and empty, with no placeholder rows", () => {
    renderPage();

    expect(screen.getByText("Modules")).toBeInTheDocument();
    expect(
      screen.getByText("This book has no modules yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
    expect(screen.queryByText("Prayer basics")).not.toBeInTheDocument();
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add module" })).toBeDisabled();
  });

  it("submits POST /api/v1/books with the canonical writable fields and no modules/audit fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: buildBookFixture({ id: "new-book-id" }) }, 201),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("In-app image ID"), {
      target: { value: "new-book-image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/books");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      title: { ar: "", en: "" },
      description: { ar: "", en: "" },
      longDescription: { ar: "", en: "" },
      imageId: "new-book-image",
      color: "#1c7ed6",
      isLocked: false,
      isPublished: false,
    });
    expect(body).not.toHaveProperty("modules");
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("createdAt");
    expect(body).not.toHaveProperty("updatedAt");
    expect(body).not.toHaveProperty("createdBy");
    expect(body).not.toHaveProperty("updatedBy");
  });

  it("transitions to the returned Book's edit route on success, without a client-generated id", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        { data: buildBookFixture({ id: "server-generated-id" }) },
        201,
      ),
    );
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    await vi.waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        "/admin/books/server-generated-id/edit",
      ),
    );
  });

  it("stays on the form and surfaces the failure when creation fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 400),
    );
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Add book" }),
    ).toBeInTheDocument();
  });
});
