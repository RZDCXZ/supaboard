export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-[400px] space-y-5">
        <div className="text-center">
          <p className="text-xl font-semibold">SupaBoard</p>
          <p className="mt-1 text-sm text-zinc-600">使用 Supabase 构建的协作任务板</p>
        </div>
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">{children}</section>
      </div>
    </main>
  );
}
