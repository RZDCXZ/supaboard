"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { TaskFilters, TaskMemberOption, TaskStatus } from "./types";

export function TaskFiltersBar({
  status,
  assignee,
  members,
  onStatusChange,
  onAssigneeChange,
  onClear,
}: {
  status: TaskFilters["status"];
  assignee: TaskFilters["assignee"];
  members: readonly TaskMemberOption[];
  onStatusChange: (status: TaskStatus | "all") => void;
  onAssigneeChange: (assignee: string) => void;
  onClear: () => void;
}) {
  const hasFilters = status !== "all" || assignee !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="任务筛选">
      <Select value={status} onValueChange={(value) => onStatusChange(value as TaskStatus | "all")}>
        <SelectTrigger aria-label="状态筛选" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="todo">待办</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={assignee} onValueChange={onAssigneeChange}>
        <SelectTrigger aria-label="负责人筛选" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">全部负责人</SelectItem>
            <SelectItem value="unassigned">未分配</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button type="button" variant="ghost" onClick={onClear}>
          清除筛选
        </Button>
      ) : null}
    </div>
  );
}
