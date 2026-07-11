import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next.js development configuration", () => {
  it("routes development assets through localhost so 127.0.0.1 bypasses local proxies", () => {
    expect(nextConfig).toMatchObject({
      assetPrefix: "http://localhost:3000",
      allowedDevOrigins: ["127.0.0.1"],
    });
  });
});
