"use client";
// components/view-cv-button.tsx
// Nút "📄 Xem CV" của staff — Nhóm 5, Đợt 5.4 của plan. Dùng ở trang chi
// tiết job (app/(app)/jobs/[jobId]/page.tsx), khối "Học viên đã ứng
// tuyển" — tương đương <a href="{{ url_for('students.cv_download', ...) }}"
// target="_blank"> trong job_detail.html (Flask).
//
// KHÔNG dùng <a href> tĩnh: signed URL (Supabase Storage) hết hạn sau 1
// giờ, plan Nhóm 5 yêu cầu gọi LẠI route cv-url mỗi lần bấm để luôn nhận
// URL còn hiệu lực, không cache ở client. Vì phải await server action
// trước khi biết URL thật, mở tab mới NGAY LÚC BẤM (đồng bộ, trong chính
// handler onClick) rồi mới gán location sau — mở window.open() sau khi
// await dễ bị trình duyệt chặn popup (không còn tính là "do người dùng
// bấm" theo con mắt trình duyệt).
//
// Giữ đúng hành vi Flask: mở tab mới (không mất trang đang xem), không tự
// dựng luồng tải-về-rồi-trả-file (route/action chỉ trả URL, trình duyệt tự
// tải trực tiếp từ Supabase).

import { useState } from "react";
import { toast } from "sonner";
import { getApplicantCvUrlAction } from "@/lib/actions/application-actions";

export function ViewCvButton({ applicationId }: { applicationId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    // Mở sẵn tab trống NGAY trong lúc xử lý click (đồng bộ) — xem lý do
    // ở comment đầu file. noopener: tab mới không giữ tham chiếu ngược
    // lại window gốc.
    const win = window.open("", "_blank", "noopener");
    const result = await getApplicantCvUrlAction(applicationId);
    setPending(false);

    if (!result.ok || !result.url) {
      win?.close();
      toast.error(result.message ?? "Không thể tạo link tải CV lúc này.");
      return;
    }
    if (win) {
      win.location.href = result.url;
    } else {
      // Trình duyệt đã chặn window.open() ngay từ đầu (hiếm, tuỳ cấu hình
      // popup blocker) — điều hướng tab hiện tại thay vì bỏ lỡ hẳn CV.
      window.location.href = result.url;
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="mt-1 inline-block text-sm font-medium text-primary underline decoration-dotted underline-offset-4 hover:no-underline disabled:opacity-60"
    >
      {pending ? "Đang mở CV…" : "📄 Xem CV"}
    </button>
  );
}
