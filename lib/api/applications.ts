// lib/api/applications.ts
// Tương đương phần "ứng tuyển/lưu job" của crawler_client bên Flask.
// CHỈ làm phần cần cho job_detail.html (Nhóm 1, phần 1) ở round này:
// staff xem ai ứng tuyển/lưu 1 job, và save/unsave job (học viên).
// CHƯA làm: POST /me/applications (nộp CV ứng tuyển thật, GET
// /me/applications, GET /jobs/applications/{id}/cv-url — thuộc Nhóm 5.

import { callAuthed } from "./client";
import type { components } from "./types";

export type JobApplicantOut = components["schemas"]["JobApplicantOut"];
export type JobSaverOut = components["schemas"]["JobSaverOut"];
export type SavedJobOut = components["schemas"]["SavedJobOut"];
export type SavedJobToggleResult = components["schemas"]["SavedJobToggleResult"];

/**
 * GET /jobs/{job_id}/applications — staff xem học viên đã ứng tuyển job
 * này. require_role("ss_team") ở backend, nên chỉ gọi hàm này khi đã
 * biết chắc user hiện tại là staff (page.tsx tự rẽ nhánh trước khi gọi,
 * KHÔNG tự check quyền lại ở đây — tương tự các hàm khác trong lib/api/).
 */
export async function listJobApplicants(jobId: string): Promise<JobApplicantOut[]> {
  return callAuthed<JobApplicantOut[]>(`/jobs/${jobId}/applications`);
}

/**
 * GET /jobs/{job_id}/saved-jobs — staff xem học viên đã LƯU (bookmark)
 * job này, khác ứng tuyển. Thêm 08/2026 phía backend, mirror đúng
 * listJobApplicants() ở trên nhưng không có field `note` (saved_jobs
 * không có cột note — chỉ là bookmark).
 */
export async function listJobSavers(jobId: string): Promise<JobSaverOut[]> {
  return callAuthed<JobSaverOut[]>(`/jobs/${jobId}/saved-jobs`);
}

/**
 * GET /me/saved-jobs — dùng để biết TRƯỚC job nào học viên đã lưu, hiện
 * đúng trạng thái "đã lưu" ngay từ SSR (không đợi client tự gọi API rồi
 * mới cập nhật UI, tránh nháy trạng thái sai lúc mới load trang).
 * Trả về Set<job_id> thay vì mảng SavedJobOut đầy đủ — nơi gọi (JobCard,
 * trang chi tiết) chỉ cần biết "đã lưu hay chưa", không cần thêm field
 * nào khác của SavedJobOut ở bước hiện trạng thái ban đầu này.
 */
export async function listMySavedJobIds(): Promise<Set<string>> {
  const rows = await callAuthed<SavedJobOut[]>("/me/saved-jobs");
  return new Set(rows.map((r) => r.job_id));
}

/**
 * POST /me/saved-jobs/toggle (Scrap_JD, "Phần 5 mục 9 của plan", thêm
 * sau khi Phần 1 lượt trước đã viết) — tự lưu nếu chưa lưu, tự bỏ lưu
 * nếu đã lưu, trong ĐÚNG 1 lần gọi. Thay thế hoàn toàn cách cũ plan mô
 * tả ban đầu (POST rồi tự bắt 409 rồi gọi tiếp DELETE) — route mới đã
 * làm đúng việc "dàn xếp" đó ở phía backend, Next.js không cần replicate
 * logic bắt-409-rồi-gọi-tiếp ở đây nữa.
 *
 * Kiểu trả về SavedJobToggleResult lấy thẳng từ types.ts (đã generate
 * lại sau khi backend có route này) — không còn type viết tay.
 */
export async function toggleSavedJob(jobId: string): Promise<SavedJobToggleResult> {
  return callAuthed<SavedJobToggleResult>("/me/saved-jobs/toggle", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId }),
  });
}
