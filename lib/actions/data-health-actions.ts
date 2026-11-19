"use server";

// lib/actions/data-health-actions.ts
// Nút "Đóng job này" của tab Tình trạng dữ liệu (/crawl?tab=status, Nhóm 6 phần 3e), ở HAI bảng: nhóm job nghi trùng
// và job đã hết hạn nhưng vẫn Đang tuyển.
//
// Khác updateJobStatusAction (job-actions.ts, note do người dùng gõ): ở đây note là câu CỐ ĐỊNH do SERVER điền theo
// `kind` (CLOSE_JOB_NOTES), client chỉ gửi loại bảng và id job. Nhờ vậy action này không gửi được note tuỳ ý, và lịch
// sử thao tác luôn nói đúng ngữ cảnh đóng job.
//
// requireStaff() ở ĐẦU: ẩn nút ở UI không thay thế được check này vì server action gọi được bằng POST tay. Backend
// PATCH /jobs/{id} cũng đòi ss_team. Next.js tự kiểm Origin của server action.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { updateJobStatus } from "@/lib/api/jobs";
import { requireStaff } from "@/lib/auth-guard";
import { CLOSE_JOB_NOTES, closeJobErrorMessage, isCloseJobKind } from "@/lib/data-ops/data-health";
import { isUuid } from "@/lib/messages";

export interface CloseJobResult {
  ok: boolean;
  message: string;
  /** true = danh sách trên trang đã cũ (job không còn) -> nơi gọi nên router.refresh(). */
  stale?: boolean;
}

export async function closeJobFromDataHealthAction(jobId: string, kind: string): Promise<CloseJobResult> {
  await requireStaff();

  if (!isUuid(jobId) || !isCloseJobKind(kind)) {
    return { ok: false, message: "Yêu cầu không hợp lệ." };
  }

  try {
    await updateJobStatus(jobId, "CLOSED", CLOSE_JOB_NOTES[kind]);
  } catch (err) {
    if (err instanceof ApiError) {
      const stale = err.status === 404;
      if (stale) revalidatePath("/crawl");
      return { ok: false, message: closeJobErrorMessage(err.status, err.message), stale };
    }
    return { ok: false, message: closeJobErrorMessage(undefined) };
  }

  revalidatePath("/crawl");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, message: "Đã đóng job." };
}
