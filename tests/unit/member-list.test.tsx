import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemberList } from "@/features/members/member-list";
import type { WorkspaceMember } from "@/features/members/types";

const members: WorkspaceMember[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "Alice",
    avatarUrl: null,
    role: "owner",
    joinedAt: "2026-07-10T00:00:00Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    displayName: "Bob",
    avatarUrl: null,
    role: "member",
    joinedAt: "2026-07-10T00:01:00Z",
  },
];

describe("MemberList", () => {
  it("renders owner-first public member details without management controls", () => {
    render(
      <MemberList
        members={members}
        retryHref="/app/workspaces/workspace-1?tab=members"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Alice")).toBeVisible();
    expect(within(rows[0]!).getByText("Owner")).toBeVisible();
    expect(within(rows[1]!).getByText("Bob")).toBeVisible();
    expect(within(rows[1]!).getByText("成员")).toBeVisible();
    expect(screen.getAllByText(/加入于/)).toHaveLength(2);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /添加|移除|降级/ })).not.toBeInTheDocument();
  });

  it("explains when the owner is the only member", () => {
    render(
      <MemberList
        members={[members[0]!]}
        retryHref="/app/workspaces/workspace-1?tab=members"
      />,
    );

    expect(screen.getByText("还没有其他成员")).toBeVisible();
  });

  it("renders the zero-member empty state", () => {
    render(
      <MemberList
        members={[]}
        retryHref="/app/workspaces/workspace-1?tab=members"
      />,
    );

    expect(screen.getByText("还没有成员")).toBeVisible();
    expect(screen.getByText("当前工作区暂时没有可显示的成员。")).toBeVisible();
  });

  it("renders an isolated error with a retry link", () => {
    render(
      <MemberList
        members={null}
        error
        retryHref="/app/workspaces/workspace-1?tab=members"
      />,
    );

    expect(screen.getByText("成员列表加载失败")).toBeVisible();
    expect(screen.getByRole("link", { name: "重试" })).toHaveAttribute(
      "href",
      "/app/workspaces/workspace-1?tab=members",
    );
  });
});
