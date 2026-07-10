import { afterEach, describe, expect, it, vi } from "vitest";

import { formatFullDateTime, formatRelativeDateTime } from "@/lib/date-time";

describe("date time formatting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats recent timestamps for quick scanning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T02:00:00Z"));

    expect(formatRelativeDateTime("2026-07-10T01:59:00Z")).toBe("1 分钟前");
    expect(formatRelativeDateTime("2026-07-10T02:01:00Z")).toBe("刚刚");
  });

  it("provides a full localized timestamp for tooltips", () => {
    expect(formatFullDateTime("2026-07-10T01:00:00Z")).toContain("2026");
  });
});
