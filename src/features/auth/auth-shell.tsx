import { Card, CardContent } from "@/components/ui/card";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-100 flex-col gap-5">
        <div className="text-center">
          <p className="text-xl font-semibold">SupaBoard</p>
          <p className="mt-1 text-sm text-muted-foreground">
            使用 Supabase 构建的协作任务板
          </p>
        </div>
        <Card>
          <CardContent className="p-8">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
