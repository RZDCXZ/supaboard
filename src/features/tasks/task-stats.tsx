import { InlineAlert } from "@/components/feedback/inline-alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { WorkspaceTaskStats } from "./types";

export function TaskStats({
  stats,
  error,
}: {
  stats: WorkspaceTaskStats | null;
  error: boolean;
}) {
  if (error || !stats) {
    return (
      <InlineAlert variant="error" title="统计暂不可用">
        任务列表仍可继续使用，请稍后刷新统计。
      </InlineAlert>
    );
  }

  const items = [
    { label: "全部", value: stats.total },
    { label: "待办", value: stats.todo },
    { label: "进行中", value: stats.inProgress },
    { label: "已完成", value: stats.done },
  ];

  return (
    <section aria-label="任务统计" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="min-h-22">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl leading-8 font-semibold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
