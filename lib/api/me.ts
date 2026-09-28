// lib/api/me.ts
// Các route /me/* dành cho HỌC VIÊN tự thao tác trên dữ liệu của chính mình
// (job đã lưu, đơn ứng tuyển) — Nhóm 5 của plan. Tương đương phần
// list_my_saved_jobs/list_my_applications/apply_to_job/withdraw_application
// của backend_auth.py bên Flask.
//
// Tất cả đi qua callAuthed(). ss_user_id luôn lấy từ JWT ở backend, không
// truyền qua path/body.
//
// KHÔNG đặt `GET /jobs/applications/{id}/cv-url` ở đây: dù trước đây nằm
// dưới tiền tố /me, đó là route CHỈ staff gọi được — plan Nhóm 5 yêu cầu để
// chung nhóm với các hàm staff xem hồ sơ ứng tuyển, không lẫn vào file này.

import { callAuthed } from "./client";
import type { components } from "./types";

export type SavedJobOut = components["schemas"]["SavedJobOut"];
export type JobApplicationOut = components["schemas"]["JobApplicationOut"];

/** GET /me/saved-jobs — danh sách bookmark của học viên hiện tại. Chỉ có
 *  job_id + vài field tóm tắt; muốn hiện đủ card thì nơi gọi tự getJob()
 *  từng job (xem profile/saved-jobs/page.tsx). */
export async function listMySavedJobs(): Promise<SavedJobOut[]> {
  return (await callAuthed<SavedJobOut[]>("/me/saved-jobs")) ?? [];
}

/** GET /me/applications — đơn ứng tuyển của học viên hiện tại. */
export async function listMyApplications(): Promise<JobApplicationOut[]> {
  return (await callAuthed<JobApplicationOut[]>("/me/applications")) ?? [];
}

/**
 * POST /me/applications — nộp CV. multipart/form-data (job_id, note?,
 * cv_file). Backend: chỉ ứng tuyển được job OPEN, CV phải là .pdf ≤ 5MB,
 * 409 nếu đã ứng tuyển rồi, rate limit 15/phút theo user_id.
 *
 * Nơi gọi PHẢI tự chuyển tiếp lỗi 409 thành "thành công nhẹ" (plan Nhóm 5:
 * ứng tuyển trùng không phải lỗi) — hàm này cứ ném ApiError bình thường.
 */
export async function applyToJob(input: {
  jobId: string;
  note?: string;
  cvFile: File;
}): Promise<JobApplicationOut> {
  const form = new FormData();
  form.append("job_id", input.jobId);
  if (input.note) form.append("note", input.note);
  form.append("cv_file", input.cvFile, input.cvFile.name);
  return callAuthed<JobApplicationOut>("/me/applications", {
    method: "POST",
    body: form,
  });
}

/**
 * DELETE /me/applications/{job_id}?note= — huỷ ứng tuyển. XOÁ HẲN CV đã nộp
 * khỏi hệ thống (backend dọn file trên storage), học viên ứng tuyển lại
 * được sau đó. note là lý do huỷ (không bắt buộc), backend ghi vào audit
 * log cho team SS xem lại, không lưu vào đơn (đơn bị xoá thật).
 * 404 PROFILE_NOT_APPLIED_YET nếu chưa/không còn đơn nào.
 */
export async function withdrawApplication(jobId: string, note?: string): Promise<void> {
  const qs = note ? `?note=${encodeURIComponent(note)}` : "";
  await callAuthed<void>(`/me/applications/${encodeURIComponent(jobId)}${qs}`, {
    method: "DELETE",
  });
}
