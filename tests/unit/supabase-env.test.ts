import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseConfig } from "@/lib/supabase/env";

describe("Supabase environment configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports a missing project URL without exposing the publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-value");

    expect(getSupabaseConfig).toThrowError(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );

    try {
      getSupabaseConfig();
    } catch (error) {
      expect(String(error)).not.toContain("publishable-key-value");
    }
  });

  it("reports a missing publishable key without exposing the project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabaseConfig).toThrowError(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );

    try {
      getSupabaseConfig();
    } catch (error) {
      expect(String(error)).not.toContain("http://127.0.0.1:54321");
    }
  });
});
