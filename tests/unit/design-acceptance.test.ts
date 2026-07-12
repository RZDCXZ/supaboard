import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

function color(variable: string) {
  const value = css.match(new RegExp(`--${variable}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`缺少颜色变量 --${variable}`);
  return value;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design accessibility tokens", () => {
  it.each([
    ["foreground", "background"],
    ["muted-foreground", "background"],
    ["primary-foreground", "primary"],
  ])("keeps %s on %s at WCAG AA contrast", (foreground, background) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the documented two-pixel teal focus ring", () => {
    expect(css).toMatch(/:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--ring\)/);
    expect(css).toMatch(/outline-offset:\s*2px/);
    expect(color("ring")).toBe("#0f766e");
  });
});
