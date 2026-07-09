"use client";

import { LayoutGridIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export type WorkspaceNavItem = {
  id: string;
  name: string;
  href: string;
};

export type AppShellUser = {
  displayName: string;
  avatarUrl?: string | null;
};

function UserAvatar({ user }: { user: AppShellUser }) {
  const initial = user.displayName.trim().charAt(0).toLocaleUpperCase() || "用";

  return (
    <Avatar>
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt={`${user.displayName}的头像`} />
      ) : null}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

function ShellNavigation({
  user,
  workspaces,
}: {
  user: AppShellUser;
  workspaces: readonly WorkspaceNavItem[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const closeMobile = () => setOpenMobile(false);

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link
          href="/app"
          className="text-lg font-semibold text-sidebar-foreground"
          onClick={closeMobile}
        >
          SupaBoard
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/app"}>
                  <Link
                    href="/app"
                    aria-current={pathname === "/app" ? "page" : undefined}
                    onClick={closeMobile}
                  >
                    <LayoutGridIcon />
                    <span>工作区总览</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>工作区</SidebarGroupLabel>
          <SidebarGroupContent>
            {workspaces.length === 0 ? (
              <div className="flex flex-col gap-1 px-2 py-3">
                <p className="text-sm text-muted-foreground">还没有工作区</p>
                <SidebarMenuButton asChild size="sm">
                  <Link href="/app" onClick={closeMobile}>
                    <PlusIcon />
                    <span>创建工作区</span>
                  </Link>
                </SidebarMenuButton>
              </div>
            ) : (
              <SidebarMenu>
                {workspaces.map((workspace) => {
                  const isActive = pathname === workspace.href;

                  return (
                    <SidebarMenuItem key={workspace.id}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={workspace.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={closeMobile}
                        >
                          <span className="truncate">{workspace.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/app/settings"}
            >
              <Link
                href="/app/settings"
                aria-current={pathname === "/app/settings" ? "page" : undefined}
                onClick={closeMobile}
              >
                <SettingsIcon />
                <span>设置</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/app/settings" onClick={closeMobile}>
                <UserAvatar user={user} />
                <span className="truncate">{user.displayName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

export function AppShell({
  user,
  workspaces,
  children,
}: {
  user: AppShellUser;
  workspaces: readonly WorkspaceNavItem[];
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <ShellNavigation user={user} workspaces={workspaces} />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <div className="flex min-h-14 items-center border-b border-border px-4 lg:hidden">
          <SidebarTrigger aria-label="打开导航" title="打开导航" />
          <span className="ml-2 font-semibold">SupaBoard</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
