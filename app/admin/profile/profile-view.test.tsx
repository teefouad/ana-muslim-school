import { act, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { onAuthStateChangedMock } = vi.hoisted(() => ({
  onAuthStateChangedMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: onAuthStateChangedMock,
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({}),
}));

import { ProfileView } from "./profile-view";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function emitUser(user: unknown) {
  const callback = onAuthStateChangedMock.mock.calls[0][1];
  act(() => callback(user));
}

describe("ProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangedMock.mockReturnValue(() => {});
  });

  it("shows the server-provided email and a loading state before auth state resolves", () => {
    renderWithProvider(<ProfileView email="server@example.com" />);

    expect(screen.getByText("Email: server@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sign-in method: Loading...")).toBeInTheDocument();
  });

  it("shows the change-password form for an email/password account", () => {
    renderWithProvider(<ProfileView email="server@example.com" />);

    emitUser({
      email: "client@example.com",
      providerData: [{ providerId: "password" }],
    });

    expect(screen.getByText("Email: client@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Sign-in method: Email and password"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeInTheDocument();
  });

  it("shows a provider message instead of a password form for a Google-only account", () => {
    renderWithProvider(<ProfileView email="server@example.com" />);

    emitUser({
      email: "client@example.com",
      providerData: [{ providerId: "google.com" }],
    });

    expect(screen.getByText("Sign-in method: Google")).toBeInTheDocument();
    expect(
      screen.getByText(/handled by your sign-in provider/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Update password" }),
    ).not.toBeInTheDocument();
  });

  it("shows a fallback message when no client auth state is available", () => {
    renderWithProvider(<ProfileView email="server@example.com" />);

    emitUser(null);

    expect(
      screen.getByText(/couldn't verify your account in this browser/),
    ).toBeInTheDocument();
  });
});
