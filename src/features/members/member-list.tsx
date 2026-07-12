import Link from "next/link";
import { UsersIcon } from "lucide-react";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatFullDateTime } from "@/lib/date-time";

import { RemoveMemberButton } from "./member-management";
import type { WorkspaceMember } from "./types";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function MemberList({
  members,
  error = false,
  retryHref,
  workspaceId,
  canManage = false,
}: {
  members: readonly WorkspaceMember[] | null;
  error?: boolean;
  retryHref: string;
  workspaceId: string;
  canManage?: boolean;
}) {
  if (error || !members) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <InlineAlert variant="error" title="成员列表加载失败">
          暂时无法读取成员，请稍后重试。
        </InlineAlert>
        <Button asChild variant="outline" className="w-fit">
          <Link href={retryHref}>重试</Link>
        </Button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 lg:px-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>还没有成员</EmptyTitle>
            <EmptyDescription>当前工作区暂时没有可显示的成员。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="sr-only">成员列表</h2>
      <ul aria-label="工作区成员" className="overflow-hidden rounded-lg border bg-card">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex min-h-20 items-center gap-4 border-b px-4 py-3 last:border-b-0 sm:px-5"
          >
            <Avatar size="lg" aria-label={`${member.displayName} 的头像`}>
              {member.avatarUrl ? (
                <AvatarImage
                  src={member.avatarUrl}
                  alt={`${member.displayName}的头像`}
                />
              ) : null}
              <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{member.displayName}</span>
                <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                  {member.role === "owner" ? "Owner" : "成员"}
                </Badge>
              </div>
              <time
                dateTime={member.joinedAt}
                className="mt-1 block text-sm text-muted-foreground"
              >
                加入于 {formatFullDateTime(member.joinedAt)}
              </time>
            </div>
            {canManage && member.role === "member" ? (
              <RemoveMemberButton
                workspaceId={workspaceId}
                userId={member.id}
                displayName={member.displayName}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {members.length === 1 && members[0]?.role === "owner" ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          还没有其他成员
        </p>
      ) : null}
    </section>
  );
}
