import { describe, expect, it } from "vitest";

import { parseWorkspaceViewSearchParams } from "@/features/activity/search-params";

describe("workspace view search params", () => {
  it("defaults invalid values to the task tab and first activity batch", () => {
    expect(
      parseWorkspaceViewSearchParams({ tab: "members", activityPage: "0" }),
    ).toEqual({ tab: "tasks", activityPage: 1 });
  });

  it("accepts the activity tab and a positive batch", () => {
    expect(
      parseWorkspaceViewSearchParams({ tab: "activity", activityPage: "3" }),
    ).toEqual({ tab: "activity", activityPage: 3 });
  });
});
