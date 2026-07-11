import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedAppLayout from "@/app/app/layout";
import SettingsPage from "@/app/app/settings/page";

const mocks = vi.hoisted(() => ({
  getCurrentUserWorkspaces: vi.fn(),
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/features/workspaces/queries", () => ({
  getCurrentUserWorkspaces: mocks.getCurrentUserWorkspaces,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const profileBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      single: mocks.profileSingle,
    };
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue(profileBuilder);

    return {
      auth: { getUser: mocks.getUser },
      from: vi.fn(() => profileBuilder),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://storage.test/${path}` },
          })),
        })),
      },
    };
  }),
}));

vi.mock("@/features/profiles/profile-settings-form", () => ({
  ProfileSettingsForm: (props: Record<string, unknown>) => (
    <div data-testid="profile-settings-form">{JSON.stringify(props)}</div>
  ),
}));

vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: ({
    user,
    children,
  }: {
    user: { avatarUrl: string | null };
    children: React.ReactNode;
  }) => (
    <div data-testid="app-shell" data-avatar-url={user.avatarUrl ?? ""}>
      {children}
    </div>
  ),
}));

const userId = "00000000-0000-4000-8000-000000000011";
const avatarPath = `${userId}/avatar.png`;

describe("profile pages", () => {
  beforeEach(() => {
    mocks.getCurrentUserWorkspaces.mockReset();
    mocks.getUser.mockReset();
    mocks.profileSingle.mockReset();
    mocks.redirect.mockReset();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.profileSingle.mockResolvedValue({
      data: { display_name: "Alice", avatar_path: avatarPath },
      error: null,
    });
    mocks.getCurrentUserWorkspaces.mockResolvedValue([]);
  });

  it("passes the current profile and public avatar URL to settings", async () => {
    render(await SettingsPage());

    expect(screen.getByTestId("profile-settings-form")).toHaveTextContent(
      JSON.stringify({
        userId,
        displayName: "Alice",
        avatarPath,
        avatarUrl: `https://storage.test/${avatarPath}`,
      }),
    );
  });

  it("passes the public avatar URL into the application shell", async () => {
    render(
      await ProtectedAppLayout({
        children: <div>内容</div>,
      }),
    );

    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-avatar-url",
      `https://storage.test/${avatarPath}`,
    );
  });
});
