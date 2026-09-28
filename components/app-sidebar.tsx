"use client";

// components/app-sidebar.tsx
// Tương đương <aside class="sidebar"> trong templates/base.html (Flask),
// dựng bằng component Sidebar của shadcn/ui (plan Phần 3 mục 2: thay
// initSidebarToggle + localStorage tự viết) — thu gọn/mở rộng, nhớ trạng
// thái, phím tắt Ctrl/Cmd+B, và bản mobile (Sheet) đều do component có sẵn
// lo. Menu lấy từ lib/nav.ts, lọc theo người xem (khách/học viên/staff).
//
// Giao diện bám 01-sidebar.css (Flask): padding 28px 20px, nút "« Thu
// gọn" nằm TRONG sidebar ngay dưới logo (không đặt ở thanh trên cùng),
// nhãn nhóm viết hoa 11px giãn chữ, mục đang chọn nền cam chữ tối, khối
// cuối là các nút full-width (btn-primary / btn-ghost). Bản trước dùng
// style mặc định của shadcn nên lệch hẳn (nhãn thường, mục active xám).

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, UserPlus, UserRound } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { UnreadBadge } from "@/components/unread-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { getVisibleNavGroups, isNavActive, type SidebarViewer } from "@/lib/nav";

// Class dùng lại nhiều chỗ — mỗi hằng số ghi rõ rule Flask tương ứng.
// Khi thu gọn (icon mode), shadcn ép nút vuông 32px bằng `!important`
// nên các override "thu gọn" bên dưới cũng phải có `!`.

/** `.nav a` + `.nav a.active` (01-sidebar.css). */
const NAV_LINK =
  "h-auto gap-2.5 rounded-[9px] px-2.5 py-[9px] text-sm text-[#C9D6D1] " +
  "hover:bg-white/6 hover:text-[#C9D6D1] " +
  "data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground " +
  "data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground " +
  "[&_svg]:size-[18px] [&_svg]:opacity-85 " +
  "group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:w-full! " +
  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2.5! " +
  "group-data-[collapsible=icon]:py-[9px]!";

/** `.nav-label` — 11px, viết hoa, giãn chữ 0.08em, màu #7C8D87. */
const NAV_LABEL =
  "mx-2.5 mb-1.5 h-auto rounded-none p-0 text-[11px] font-normal uppercase tracking-[0.08em] " +
  "text-[#7C8D87] group-data-[collapsible=icon]:hidden";

/** `.btn.btn-block` (03-layout.css + 01-sidebar.css). */
const BTN_BLOCK =
  "mb-2 flex w-full items-center justify-center gap-2 rounded-[9px] border border-transparent " +
  "px-[18px] py-2.5 text-center text-sm font-semibold whitespace-nowrap last:mb-0 " +
  "group-data-[collapsible=icon]:px-1.5";
const BTN_PRIMARY = "bg-sidebar-primary text-[#16130E] hover:bg-[#E64D28]";
const BTN_GHOST =
  "border-border bg-card text-foreground hover:border-foreground disabled:opacity-60";

/** `.btn-text-label` — chữ ẩn khi thu gọn, chỉ còn icon. */
const BTN_LABEL = "group-data-[collapsible=icon]:hidden";

export function AppSidebar({ viewer }: { viewer: SidebarViewer | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const groups = getVisibleNavGroups(viewer);
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed";

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
      {/* .sidebar { padding: 28px 20px } — thu gọn: 14px hai bên. */}
      <SidebarHeader className="gap-0 px-5 pt-7 pb-0 group-data-[collapsible=icon]:px-3.5">
        {/* .brand */}
        <div className="mb-[22px] flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary font-heading text-sm font-bold text-[#10120C]">
            MX
          </span>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <strong className="font-heading text-base">Career Hub</strong>
            <span className="text-xs text-[#9FB0AA]">Student Success</span>
          </div>
        </div>

        {/* .sidebar-toggle — chỉ desktop; ở màn hẹp sidebar là Sheet, đóng
            bằng vùng ngoài. Phím tắt Ctrl/Cmd+B của shadcn vẫn dùng được. */}
        {!isMobile && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Thu gọn / mở rộng sidebar"
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-expanded={!collapsed}
            className="mb-[26px] flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-transparent p-2 text-[12.5px] text-[#9FB0AA] hover:bg-white/6 hover:text-[#EAF2EF]"
          >
            <span className="text-[13px] leading-none">{collapsed ? "»" : "«"}</span>
            {!collapsed && <span>Thu gọn</span>}
          </button>
        )}
      </SidebarHeader>

      <SidebarContent className="px-5 group-data-[collapsible=icon]:px-3.5">
        {groups.map((group, index) => (
          <SidebarGroup key={group.label} className="p-0">
            {/* .nav-label { margin: 18px 10px 6px } và :first-child { margin-top: 0 } */}
            <SidebarGroupLabel className={`${NAV_LABEL} ${index === 0 ? "mt-0" : "mt-[18px]"}`}>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-[3px]">
                {group.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        aria-current={active ? "page" : undefined}
                        className={NAV_LINK}
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
          <SidebarGroup className="p-0 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className={`${NAV_LABEL} mt-[18px]`}>Học viên</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="mx-2.5 mb-3 text-[12.5px] leading-normal text-muted-foreground">
                Xem &quot;Job đã lưu&quot; / &quot;Đã ứng tuyển&quot; trong{" "}
                <Link href="/profile" className="underline">
                  Trang cá nhân
                </Link>
                .
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* .sidebar-foot — đường kẻ trên, padding-top 20px */}
      <SidebarFooter className="mx-5 gap-0 border-t border-white/10 px-0 pt-5 pb-7 group-data-[collapsible=icon]:mx-3.5">
        {viewer ? (
          <>
            {/* .auth-box */}
            <Link
              href="/profile"
              title="Trang cá nhân"
              className="mb-3 flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
            >
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-sidebar-primary font-heading font-bold text-[#16130E]">
                {viewer.fullName.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="flex min-w-0 flex-col leading-[1.3] group-data-[collapsible=icon]:hidden">
                <strong className="truncate text-[13px] text-[#EAF2EF]">{viewer.fullName}</strong>
                <span className="truncate text-[11px] text-[#8FA29B]">
                  {viewer.isStaff ? (ROLE_LABELS[viewer.role] ?? viewer.email) : viewer.email}
                </span>
              </span>
            </Link>
            <Link href="/profile" title="Trang cá nhân" className={`${BTN_BLOCK} ${BTN_GHOST}`}>
              <UserRound className="hidden size-4 group-data-[collapsible=icon]:block" />
              <span className={BTN_LABEL}>Trang cá nhân</span>
            </Link>
            <button
              type="button"
              title="Đăng xuất"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className={`${BTN_BLOCK} ${BTN_GHOST} cursor-pointer`}
            >
              <LogOut className="hidden size-4 group-data-[collapsible=icon]:block" />
              <span className={BTN_LABEL}>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
            </button>
          </>
        ) : (
          <>
            {/* .auth-box-guest p */}
            <p className="mb-3 text-[12.5px] leading-normal text-[#9FB0AA] group-data-[collapsible=icon]:hidden">
              Học viên MindX? Đăng nhập để lưu job và ứng tuyển.
            </p>
            <Link href="/login" title="Đăng nhập" className={`${BTN_BLOCK} ${BTN_PRIMARY}`}>
              <LogIn className="hidden size-4 group-data-[collapsible=icon]:block" />
              <span className={BTN_LABEL}>Đăng nhập</span>
            </Link>
            <Link href="/register" title="Đăng ký" className={`${BTN_BLOCK} ${BTN_GHOST}`}>
              <UserPlus className="hidden size-4 group-data-[collapsible=icon]:block" />
              <span className={BTN_LABEL}>Đăng ký</span>
            </Link>
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
