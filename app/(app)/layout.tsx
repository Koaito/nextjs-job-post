// app/(app)/layout.tsx
// Tương đương templates/base.html (Flask) — layout THẬT của Nhóm 1
// (thay bản tối thiểu 22/09). Gồm: sidebar (shadcn Sidebar), Sonner thay
// FlashStack, <UnreadBadge/> (nằm trong sidebar), SavedJobsProvider thay
// context_processor inject_saved_job_ids. CHƯA có <EmailTemplateModal>
// (chờ Nhóm 2 — đã chốt ở Round 5).
//
// QUAN TRỌNG (plan dòng 359, 855): layout này che CẢ route public
// (/jobs, /jobs/[jobId]) lẫn route cần login (/profile/security,
// /them-moi...) — nên KHÔNG được gọi requireUser()/requireStaff() ở đây
// (sẽ chặn nhầm /jobs cho khách chưa đăng nhập). Chỉ ĐỌC getSessionState()
// (trả null cho khách) rồi rẽ nhánh UI. Guard thật nằm ở TỪNG route con
// cần login tự gọi requireUser()/requireStaff().
//
// Fetch ngay trong layout (getSessionState + danh sách job đã lưu) — an
// toàn với Phụ lục A của plan vì cả 2 đều đi qua getValidAccessToken()
// đã bọc React.cache(): trong 1 lần render chỉ tối đa 1 lần /auth/refresh.
//
// LỆCH CÓ CHỦ ĐÍCH so với plan dòng 945 (script inline chống FOUC cho
// sidebar): shadcn SidebarProvider tự ghi cookie `sidebar_state` mỗi lần
// đóng/mở, nên Server Component đọc lại cookie đó ngay ở đây và truyền
// vào defaultOpen — HTML đầu tiên đã đúng độ rộng, không cần script
// dangerouslySetInnerHTML và không có nháy nào (Flask phải dùng script vì
// là MPA không có bước render phía server đọc được localStorage).

import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionEndListener } from "@/components/session-end-listener";
import { SavedJobsProvider } from "@/components/saved-jobs-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listMySavedJobIds } from "@/lib/api/applications";
import type { SidebarViewer } from "@/lib/nav";
import { getSessionState } from "@/lib/session";

// Tên cookie shadcn SidebarProvider tự ghi (const nội bộ, không export
// từ components/ui/sidebar.tsx) — nếu sau này chạy lại `shadcn add
// sidebar` và tên đổi thì sửa ở đây.
const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ user, endReason }, cookieStore] = await Promise.all([getSessionState(), cookies()]);
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  // Chỉ gọi khi đã đăng nhập, và KHÔNG lọc theo !is_staff: _job_card.html
  // hiện nút Lưu job cho mọi role, nên cần đúng trạng thái đã lưu cho cả
  // staff (giữ nguyên quyết định đã có ở jobs/page.tsx trước đây). Lỗi bị
  // nuốt (badge/icon chỉ là phụ trợ, không đáng làm hỏng cả trang) — giống
  // inject_saved_job_ids() bên Flask.
  const savedJobIds = user
    ? await listMySavedJobIds()
        .then((ids) => [...ids])
        .catch(() => [] as string[])
    : [];

  const viewer: SidebarViewer | null = user
    ? {
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        isStaff: user.is_staff,
      }
    : null;

  return (
    <TooltipProvider>
      {/* key theo user: đổi tài khoản trên cùng tab thì Provider mount lại
          với danh sách đã lưu của người mới, không giữ state người cũ. */}
      <SavedJobsProvider key={user?.ss_user_id ?? "guest"} initialSavedJobIds={savedJobIds}>
        {/* Bề rộng khớp Flask: --sidebar-width 248px, thu gọn 76px (00-tokens.css). */}
        <SidebarProvider
          defaultOpen={defaultOpen}
          style={
            {
              "--sidebar-width": "248px",
              "--sidebar-width-icon": "76px",
            } as React.CSSProperties
          }
        >
          <AppSidebar viewer={viewer} />
          <SidebarInset className="min-w-0">
            {/* Flask không có thanh trên cùng ở desktop — nút "« Thu gọn"
                nằm TRONG sidebar (xem app-sidebar.tsx). Thanh này chỉ còn
                trên màn hẹp, nơi sidebar là Sheet cần 1 nút để mở. */}
            <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4 md:hidden">
              <SidebarTrigger />
            </header>
            {/* .content (03-layout.css): padding 40px 40px 64px,
                max-width 1800px, canh giữa; màn hẹp (<900px) padding 24px. */}
            <div className="mx-auto w-full max-w-[1800px] flex-1 px-6 pt-6 pb-16 md:px-10 md:pt-10">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SavedJobsProvider>
      <Toaster richColors position="top-right" />
      {/* Phụ lục C: báo phiên kết thúc (đăng nhập nơi khác / bị thu hồi) +
          đồng bộ giữa các tab. Đặt SAU <Toaster/> có chủ đích: effect của
          anh em chạy theo thứ tự, Toaster phải đăng ký lắng nghe xong thì
          toast gọi từ effect của listener mới không bị mất. */}
      <SessionEndListener reason={endReason} />
    </TooltipProvider>
  );
}
