import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOAuth: mocks.signInWithOAuth },
  })),
}));

import { signInWithGitHub } from "@/features/auth/actions";

describe("GitHub OAuth action", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.redirect.mockReset();
    mocks.signInWithOAuth.mockReset();
    mocks.headers.mockResolvedValue(
      new Headers({ origin: "http://localhost:3000" }),
    );
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  it("uses GitHub with the local callback and redirects to the provider", async () => {
    const providerUrl = "https://github.com/login/oauth/authorize?client_id=test";
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: providerUrl },
      error: null,
    });

    await expect(signInWithGitHub()).rejects.toThrow(`REDIRECT:${providerUrl}`);
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fapp" },
    });
  });

  it("maps provider startup failures to a stable login error", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "provider disabled" },
    });

    await expect(signInWithGitHub()).rejects.toThrow(
      "REDIRECT:/login?error=oauth",
    );
  });
});
