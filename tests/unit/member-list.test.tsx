import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemberList } from "@/features/members/member-list";
import { AddMemberDialog } from "@/features/members/member-management";
import type { WorkspaceMember } from "@/features/members/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
  it("renders owner-first public member details with controls only for ordinary members", () => {
    render(
      <MemberList
        members={members}
        retryHref="/app/workspaces/workspace-1?tab=members"
        workspaceId="11111111-1111-4111-8111-111111111111"
        canManage
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Alice")).toBeVisible();
    expect(within(rows[0]!).getByText("Owner")).toBeVisible();
    expect(within(rows[1]!).getByText("Bob")).toBeVisible();
    expect(within(rows[1]!).getByText("成员")).toBeVisible();
    expect(screen.getAllByText(/加入于/)).toHaveLength(2);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(within(rows[0]!).queryByRole("button", { name: /移除/ })).not.toBeInTheDocument();
    expect(within(rows[1]!).getByRole("button", { name: "移除 Bob" })).toBeVisible();
  });

  it("does not expose management controls to ordinary members", () => {
    render(
      <MemberList
        members={members}
        retryHref="/app/workspaces/workspace-1?tab=members"
        workspaceId="11111111-1111-4111-8111-111111111111"
        canManage={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /移除/ })).not.toBeInTheDocument();
  });

  it("opens an email-only add member dialog", () => {
    render(
      <AddMemberDialog workspaceId="11111111-1111-4111-8111-111111111111" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
    expect(screen.getByRole("dialog", { name: "添加成员" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "邮箱" })).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByText("仅可添加已经注册的用户。")).toBeVisible();
  });

  it("explains when the owner is the only member", () => {
    render(
      <MemberList
        members={[members[0]!]}
        retryHref="/app/workspaces/workspace-1?tab=members"
        workspaceId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByText("还没有其他成员")).toBeVisible();
  });

  it("renders the zero-member empty state", () => {
    render(
      <MemberList
        members={[]}
        retryHref="/app/workspaces/workspace-1?tab=members"
        workspaceId="11111111-1111-4111-8111-111111111111"
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
        workspaceId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByText("成员列表加载失败")).toBeVisible();
    expect(screen.getByRole("link", { name: "重试" })).toHaveAttribute(
      "href",
      "/app/workspaces/workspace-1?tab=members",
    );
  });
});
