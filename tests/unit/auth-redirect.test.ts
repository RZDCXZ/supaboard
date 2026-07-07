import { describe, expect, it } from "vitest";

import { getSafeNextPath } from "@/features/auth/redirect";

describe("getSafeNextPath", () => {
  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)"])(
    "rejects external redirect target %s",
    (target) => {
      expect(getSafeNextPath(target)).toBe("/app");
    },
  );

  it("allows an internal absolute path", () => {
    expect(getSafeNextPath("/app/settings?tab=profile")).toBe(
      "/app/settings?tab=profile",
    );
  });

  it("falls back when the target is missing", () => {
    expect(getSafeNextPath(null)).toBe("/app");
  });
});
