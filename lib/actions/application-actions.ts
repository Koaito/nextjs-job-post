"use server";

// lib/actions/application-actions.ts
// Server action HUỶ ứng tuyển của học viên — Nhóm 5, Đợt 5.3 của plan.
// Tương đương blueprints/my_stuff.py::job_withdraw() (Flask).
//
// (Nộp CV KHÔNG nằm ở đây mà ở Route Handler app/api/applications/route.ts
// vì là upload file tới 5MB — xem comment ở file đó.)
//
// Plan: huỷ ứng tuyển XOÁ HẲN CV đã nộp; note lý do là KHÔNG bắt buộc (gửi
// cho team SS tham khảo, backend ghi vào audit log). Dùng chung cho cả trang
// chi tiết job lẫn /profile/applications qua <WithdrawApplicationButton>.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { withdrawApplication } from "@/lib/api/me";
import { getCurrentUser } from "@/lib/session";

export interface WithdrawApplicationResult {
  ok: boolean;
  message: string;
}

export async function withdrawApplicationAction(
  jobId: string,
  note?: string,
): Promise<WithdrawApplicationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }
  // Khớp Flask (job_withdraw: staff -> 404): staff không có đơn ứng tuyển.
  if (user.is_staff) {
    return { ok: false, message: "Tài khoản team SS không có đơn ứng tuyển." };
  }

  try {
    await withdrawApplication(jobId, note?.trim() || undefined);
  } catch (err) {
    // 404 (PROFILE_NOT_APPLIED_YET): đơn đã bị huỷ ở tab khác -> mục tiêu
    // (không còn đơn) đã đạt, coi là thành công — cùng cách
    // deleteContactAction()/deleteEmailTemplateAction().
    if (err instanceof ApiError && err.status === 404) {
      revalidatePath("/profile/applications");
      return { ok: true, message: "Đơn ứng tuyển này đã được huỷ trước đó." };
    }
    if (err instanceof ApiError && err.status === 429) {
      return { ok: false, message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể huỷ ứng tuyển, thử lại sau.";
    return { ok: false, message };
  }

  revalidatePath("/profile/applications");
  return { ok: true, message: "Đã huỷ ứng tuyển." };
}
