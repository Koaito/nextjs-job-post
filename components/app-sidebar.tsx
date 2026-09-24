"use client";

// components/app-sidebar.tsx
// Tương đương <aside class="sidebar"> trong templates/base.html (Flask),
// dựng bằng component Sidebar của shadcn/ui (plan Phần 3 mục 2: thay
// initSidebarToggle + localStorage tự viết) — thu gọn/mở rộng, nhớ trạng
// thái, phím tắt Ctrl/Cmd+B, và bản mobile (Sheet) đều do component có sẵn
// lo. Menu lấy từ lib/nav.ts, lọc theo người xem (khách/học viên/staff).

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { UnreadBadge } from "@/components/unread-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { getVisibleNavGroups, isNavActive, type SidebarViewer } from "@/lib/nav";

export function AppSidebar({ viewer }: { viewer: SidebarViewer | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const groups = getVisibleNavGroups(viewer);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(`logout failed: ${res.status}`);
      // Giống login-form.tsx: push + refresh. (app) -> (public) là 2 route
      // group khác nhau nên layout (app) bị unmount -> SavedJobsProvider và
      // <UnreadBadge> mất state cũ; router.refresh() bỏ cache RSC của phiên
      // cũ. Riêng cache SWR toàn cục của badge chỉ thành vấn đề khi bật
      // nhóm "Nhắn tin" (Nhóm 4) — lúc đó nhớ mutate() khi đăng xuất.
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Không thể đăng xuất, vui lòng thử lại.");
      setIsLoggingOut(false);
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground">
            MX
          </span>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <strong className="truncate font-heading text-sm">Career Hub</strong>
            <span className="truncate text-xs text-sidebar-foreground/70">
              Student Success
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge === "unread-messages" && <UnreadBadge />}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Học viên: không có mục riêng trong menu — trỏ sang Trang cá
            nhân (khớp khối `.nav-note` cuối nav bên Flask). */}
        {viewer && !viewer.isStaff && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Học viên</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 text-xs leading-relaxed text-sidebar-foreground/70">
                Xem &quot;Job đã lưu&quot; / &quot;Đã ứng tuyển&quot; trong{" "}
                <Link href="/profile" className="underline underline-offset-2">
                  Trang cá nhân
                </Link>
                .
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {viewer ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/profile" />}
                tooltip="Trang cá nhân"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-sm font-semibold text-sidebar-primary-foreground">
                  {viewer.fullName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <strong className="truncate text-sm">{viewer.fullName}</strong>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {viewer.isStaff
                      ? (ROLE_LABELS[viewer.role] ?? viewer.email)
                      : viewer.email}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Đăng xuất"
                disabled={isLoggingOut}
                onClick={handleLogout}
              >
                <LogOut />
                <span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <>
            <p className="px-2 text-xs leading-relaxed text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
              Học viên MindX? Đăng nhập để lưu job và ứng tuyển.
            </p>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/login" />}
                  tooltip="Đăng nhập"
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                >
                  <LogIn />
                  <span>Đăng nhập</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/register" />} tooltip="Đăng ký">
                  <UserPlus />
                  <span>Đăng ký</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
