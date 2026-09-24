"use server";

// lib/actions/job-actions.ts
// Server Action cho job_detail.html (Nhóm 1, phần 1) — KHÔNG qua Route
// Handler như 5 luồng auth (plan chỉ chốt BFF riêng cho auth, xem Phần 1
// mục 2.3), gọi thẳng lib/api/*.ts.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { toggleSavedJob } from "@/lib/api/applications";
import { updateJobStatus } from "@/lib/api/jobs";

export interface ToggleSaveJobResult {
  ok: boolean;
  saved?: boolean;
  errorMessage?: string;
}

/**
 * Dùng cho <SaveJobButton> (useOptimistic) — gọi POST /me/saved-jobs/toggle
 * (route mới, xem lib/api/applications.ts::toggleSavedJob) trong ĐÚNG 1
 * lần gọi cho mỗi lần bấm nút, không tự bắt 409 rồi gọi tiếp DELETE như
 * cách cũ plan mô tả ban đầu.
 *
 * revalidatePath cả 2 nơi job này có thể đang hiển thị icon "đã lưu"
 * (trang danh sách + trang chi tiết) — dù useOptimistic đã cập nhật UI
 * ngay lập tức phía component gọi action này, revalidatePath vẫn cần
 * để lần load trang KẾ TIẾP (SSR, không phải optimistic) phản ánh đúng
 * trạng thái mới, không riêng gì job vừa bấm ở component hiện tại.
 */
export async function toggleSaveJobAction(jobId: string): Promise<ToggleSaveJobResult> {
  try {
    const result = await toggleSavedJob(jobId);
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, saved: result.saved };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Không thể lưu job lúc này, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

export interface UpdateJobStatusResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Dùng cho <JobStatusPanel> (staff-only, ở app/(app)/jobs/[jobId]/) —
 * gộp chung cho cả 2 nút "Cập nhật trạng thái" (mọi status) và "Đóng
 * job" (status="CLOSED" cố định), đúng cách job_detail.html dùng chung
 * 1 hàm update_job_status() cho cả jobStatusModal/jobDeleteModal.
 *
 * KHÔNG dùng useOptimistic ở đây (khác toggleSaveJobAction ở trên) —
 * đây là thao tác có note, plan yêu cầu luồng "thu note trước -> gọi
 * server action -> cập nhật UI khi thành công", không cập nhật lạc
 * quan trước khi biết kết quả thật.
 */
export async function updateJobStatusAction(
  jobId: string,
  status: "OPEN" | "CLOSED",
  note?: string,
): Promise<UpdateJobStatusResult> {
  try {
    await updateJobStatus(jobId, status, note);
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái job, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}
