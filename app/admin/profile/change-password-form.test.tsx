import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  credentialMock,
  reauthenticateMock,
  updatePasswordMock,
  establishSessionMock,
  getIdTokenMock,
  currentUser,
} = vi.hoisted(() => {
  const getIdTokenMock = vi.fn().mockResolvedValue("fresh-id-token");
  return {
    credentialMock: vi.fn(
      (email: string, password: string) => ({ email, password }) as never,
    ),
    reauthenticateMock: vi.fn(),
    updatePasswordMock: vi.fn(),
    establishSessionMock: vi.fn(),
    getIdTokenMock,
    currentUser: {
      email: "user@example.com",
      providerData: [],
      getIdToken: getIdTokenMock,
    } as never,
  };
});

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: credentialMock },
  reauthenticateWithCredential: reauthenticateMock,
  updatePassword: updatePasswordMock,
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({ currentUser }),
}));

vi.mock("@/app/login/establish-session", () => ({
  establishSession: establishSessionMock,
}));

import { ChangePasswordForm } from "./change-password-form";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function fillAndSubmit(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/^Current password/), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reauthenticateMock.mockResolvedValue(undefined);
    updatePasswordMock.mockResolvedValue(undefined);
    establishSessionMock.mockResolvedValue(undefined);
    getIdTokenMock.mockResolvedValue("fresh-id-token");
  });

  it("shows an error and never calls Firebase when the confirmation doesn't match", async () => {
    renderWithProvider(<ChangePasswordForm />);

    fillAndSubmit("current-pw", "new-password-1", "different-password");

    expect(
      await screen.findByText("New password and confirmation do not match."),
    ).toBeInTheDocument();
    expect(reauthenticateMock).not.toHaveBeenCalled();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("re-authenticates with the current password, then updates to the new password", async () => {
    renderWithProvider(<ChangePasswordForm />);

    fillAndSubmit("current-pw", "new-password-1", "new-password-1");

    await waitFor(() => expect(establishSessionMock).toHaveBeenCalledTimes(1));

    expect(credentialMock).toHaveBeenCalledWith(
      "user@example.com",
      "current-pw",
    );
    expect(reauthenticateMock).toHaveBeenCalledWith(
      currentUser,
      expect.objectContaining({ email: "user@example.com" }),
    );
    expect(updatePasswordMock).toHaveBeenCalledWith(
      currentUser,
      "new-password-1",
    );
    expect(getIdTokenMock).toHaveBeenCalledWith(true);
    expect(establishSessionMock).toHaveBeenCalledWith("fresh-id-token");

    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Current password/)).toHaveValue("");
    expect(screen.getByLabelText(/^New password/)).toHaveValue("");
    expect(screen.getByLabelText(/^Confirm new password/)).toHaveValue("");
  });

  it("surfaces a friendly error and does not update the password when the current password is wrong", async () => {
    reauthenticateMock.mockRejectedValueOnce({ code: "auth/wrong-password" });

    renderWithProvider(<ChangePasswordForm />);

    fillAndSubmit("wrong-pw", "new-password-1", "new-password-1");

    expect(
      await screen.findByText("Your current password is incorrect."),
    ).toBeInTheDocument();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });
});
