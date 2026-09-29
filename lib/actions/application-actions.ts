"use server";

// lib/actions/application-actions.ts
// Server action cho các thao tác quanh đơn ứng tuyển. 2 nhóm:
//   - HỌC VIÊN tự huỷ đơn của chính mình (Nhóm 5, Đợt 5.3) —
//     withdrawApplicationAction(), tương đương
//     blueprints/my_stuff.py::job_withdraw() (Flask).
//   - STAFF xem CV học viên khác đã nộp (Nhóm 5, Đợt 5.4) —
//     getApplicantCvUrlAction() ở cuối file, tương đương
//     blueprints/students.py::cv_download() (nhưng gọi trực tiếp từ trang
//     chi tiết job, không phải trang hoạt động học viên — xem comment tại
//     hàm đó).
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
import { getApplicantCvUrl } from "@/lib/api/applications";
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

// ---------------------------------------------------------------------------
// Nhóm 5, Đợt 5.4 — Staff "Xem CV" 1 đơn ứng tuyển (job_detail.html,
// khối "Học viên đã ứng tuyển"). Đây là hành động STAFF xem CV NGƯỜI
// KHÁC nộp (khác toàn bộ action còn lại trong file này, của HỌC VIÊN tự
// thao tác trên đơn của chính mình) — vẫn đặt chung file vì cùng domain
// "applications", chỉ khác chiều truy cập; hàm API nền
// (getApplicantCvUrl, lib/api/applications.ts) đã đặt cùng nhóm
// listJobApplicants/listJobSavers, không đặt trong lib/api/me.ts.
//
// KHÔNG requireStaff()/check role riêng ở đây — nút "Xem CV" chỉ render
// trong nhánh isStaff của job/[jobId]/page.tsx (page tự rẽ nhánh trước
// khi cho bấm), backend vẫn tự chặn bằng require_role("ss_team") nếu bị
// gọi sai cách — cùng quy ước updateJobStatusAction() ở lib/actions/
// job-actions.ts.
//
// Gọi LẠI route này mỗi lần bấm (không cache url ở client) — signed URL
// hết hạn sau 1 giờ (plan Nhóm 5, mục cv-url).

export interface GetApplicantCvUrlResult {
  ok: boolean;
  url?: string;
  message?: string;
}

export async function getApplicantCvUrlAction(applicationId: string): Promise<GetApplicantCvUrlResult> {
  try {
    const url = await getApplicantCvUrl(applicationId);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, message: "Học viên chưa nộp CV cho đơn này." };
    }
    if (err instanceof ApiError && err.status === 429) {
      return { ok: false, message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể tạo link tải CV lúc này.";
    return { ok: false, message };
  }
}
