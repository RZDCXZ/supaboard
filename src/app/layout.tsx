import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupaBoard",
  description: "使用 Supabase 构建的协作任务板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
