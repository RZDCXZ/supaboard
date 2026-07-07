import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  signupSchema,
} from "@/features/auth/validation";

describe("Auth input validation", () => {
  it("normalizes valid login email addresses", () => {
    expect(
      loginSchema.parse({ email: "  USER@example.com ", password: "password123" }),
    ).toEqual({ email: "user@example.com", password: "password123" });
  });

  it("rejects malformed email addresses", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("requires passwords to contain at least eight characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });

  it("requires matching passwords when signing up", () => {
    expect(
      signupSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "different123",
      }).success,
    ).toBe(false);
  });
});
