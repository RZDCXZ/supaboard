import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("suppresses browser-extension attribute mismatches only on the html element", () => {
    const layout = RootLayout({ children: <main>内容</main> });

    expect(layout.props.suppressHydrationWarning).toBe(true);
    expect(layout.props.children.props.suppressHydrationWarning).toBeUndefined();
  });
});
