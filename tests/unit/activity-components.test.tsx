import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityTimeline } from "@/features/activity/activity-timeline";
import type { ActivityPage } from "@/features/activity/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

function page(overrides: Partial<ActivityPage> = {}): ActivityPage {
  return {
    activities: [],
    batch: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    ...overrides,
  };
}

describe("ActivityTimeline", () => {
  it("renders system and status-change activity as read-only text", () => {
    render(
      <ActivityTimeline
        page={page({
          total: 2,
          activities: [
            {
              id: 2,
              workspaceId,
              actor: {
                id: "33333333-3333-4333-8333-333333333333",
                displayName: "Alice",
                avatarUrl: null,
              },
              action: "task.status_changed",
              entityId,
              title: "Ship stage 8",
              fromStatus: "todo",
              toStatus: "done",
              status: null,
              createdAt: "2026-07-10T02:00:00Z",
            },
            {
              id: 1,
              workspaceId,
              actor: null,
              action: "task.created",
              entityId,
              title: "Ship stage 8",
              fromStatus: null,
              toStatus: null,
              status: null,
              createdAt: "2026-07-10T01:00:00Z",
            },
          ],
        })}
        loadMoreHref={null}
        retryHref={`/app/workspaces/${workspaceId}?tab=activity`}
      />,
    );

    expect(
      screen.getByText("Alice 将任务“Ship stage 8”从“待办”改为“已完成”"),
    ).toBeVisible();
    expect(screen.getByText("系统 创建了任务“Ship stage 8”")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Ship stage 8/ })).not.toBeInTheDocument();
  });

  it("uses a short task id fallback and exposes load more", () => {
    render(
      <ActivityTimeline
        page={page({
          total: 21,
          hasMore: true,
          activities: [
            {
              id: 1,
              workspaceId,
              actor: null,
              action: "task.deleted",
              entityId,
              title: null,
              fromStatus: null,
              toStatus: null,
              status: "done",
              createdAt: "2026-07-10T01:00:00Z",
            },
          ],
        })}
        loadMoreHref={`/app/workspaces/${workspaceId}?tab=activity&activityPage=2`}
        retryHref={`/app/workspaces/${workspaceId}?tab=activity`}
      />,
    );

    expect(screen.getByText(/22222222/)).toBeVisible();
    expect(screen.getByRole("link", { name: "加载更多" })).toHaveAttribute(
      "href",
      `/app/workspaces/${workspaceId}?tab=activity&activityPage=2`,
    );
  });

  it("renders isolated error and empty states", () => {
    const { rerender } = render(
      <ActivityTimeline
        page={null}
        error
        loadMoreHref={null}
        retryHref={`/app/workspaces/${workspaceId}?tab=activity`}
      />,
    );

    expect(screen.getByText("活动记录加载失败")).toBeVisible();
    expect(screen.getByRole("link", { name: "重试" })).toBeVisible();

    rerender(
      <ActivityTimeline
        page={page()}
        loadMoreHref={null}
        retryHref={`/app/workspaces/${workspaceId}?tab=activity`}
      />,
    );
    expect(screen.getByText("还没有任务活动")).toBeVisible();
  });
});
