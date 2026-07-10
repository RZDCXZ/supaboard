"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { WorkspaceTab } from "./types";

export function WorkspaceTabs({ tab }: { tab: WorkspaceTab }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  function changeTab(value: string) {
    if (value !== "tasks" && value !== "activity") return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    params.delete("activityPage");

    if (value === "activity") params.set("tab", "activity");
    else params.delete("tab");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6 lg:px-8">
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList variant="line" aria-label="工作区内容">
          <TabsTrigger value="tasks" disabled={isNavigating}>
            任务
          </TabsTrigger>
          <TabsTrigger value="activity" disabled={isNavigating}>
            活动
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
