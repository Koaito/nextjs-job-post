"use server";

// lib/actions/job-actions.ts
// Server Action cho job_detail.html (Nhóm 1, phần 1) — KHÔNG qua Route
// Handler như 5 luồng auth (plan chỉ chốt BFF riêng cho auth, xem Phần 1
// mục 2.3), gọi thẳng lib/api/*.ts.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { toggleSavedJob } from "@/lib/api/applications";
import { updateJobStatus, createJob, updateJob, type JobCreate, type JobUpdate } from "@/lib/api/jobs";
import { createCompany } from "@/lib/api/companies";
import type { CompanyFieldValue } from "@/components/company-combobox";

export interface ToggleSaveJobResult {
  ok: boolean;
  saved?: boolean;
  errorMessage?: string;
}

/**
 * Dùng cho <SaveJobButton> (cập nhật lạc quan qua SavedJobsProvider) —
 * gọi POST /me/saved-jobs/toggle
 * (route mới, xem lib/api/applications.ts::toggleSavedJob) trong ĐÚNG 1
 * lần gọi cho mỗi lần bấm nút, không tự bắt 409 rồi gọi tiếp DELETE như
 * cách cũ plan mô tả ban đầu.
 *
 * KHÔNG revalidatePath ở đây (Round 5): trạng thái "đã lưu" giờ nằm ở
 * <SavedJobsProvider> (app/(app)/layout.tsx) và <SaveJobButton> tự cập
 * nhật Provider ngay khi bấm — không trang nào còn đọc trạng thái này
 * từ dữ liệu SSR riêng của nó. revalidatePath trong Server Action còn
 * khiến Next render lại cả trang + layout sau MỖI lần bấm (thêm 2 lượt
 * gọi backend: /auth/me + /me/saved-jobs) mà không thay đổi gì trên màn
 * hình. Khi làm trang "Job đã lưu" (Nhóm 5), trang đó tự lo việc của nó.
 */
export async function toggleSaveJobAction(jobId: string): Promise<ToggleSaveJobResult> {
  try {
    const result = await toggleSavedJob(jobId);
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

// ---------------------------------------------------------------------------
// Nhóm 1, phần 3b — <JobForm> (Round 3). createJobAction() được viết đủ ở
// round này để Round 4 (/them-moi) chỉ việc gọi thẳng, KHÔNG trang nào gọi
// tới hàm này ở round 3 (chưa có /them-moi, /jobs/add vẫn giữ nguyên tới
// khi làm Round 4 — xem quyết định trong lịch sử trao đổi). updateJobAction()
// LÀ hàm được /jobs/[jobId]/edit gọi thật ở round này.

export interface JobFormPayload {
  jobTitle: string;
  matchingIndustry: string;
  levelCode: string;
  provinceName: string;
  workType: string;
  currency: string;
  salaryMin: string;
  salaryMax: string;
  salaryType: string;
  salaryPeriod: string;
  deadline: string;
  skills: string;
  description: string;
  requirements: string;
  benefits: string;
}

export interface JobActionResult {
  ok: boolean;
  errorMessage?: string;
  /** Lỗi theo từng field — dùng để <JobForm> hiện lỗi tại chỗ + giữ
   *  nguyên input đã nhập (đúng yêu cầu plan cho /them-moi: "giữ nguyên
   *  tab đang mở + giữ lại dữ liệu đã nhập ở tab đó, không nhảy sang
   *  trang khác" — round này JobForm đã tự giữ state, hàm chỉ cần trả
   *  key lỗi để tô đỏ đúng field). */
  fieldErrors?: Record<string, string>;
  jobId?: string;
  /** true = nhánh "Tạo công ty mới" thực ra gắn vào công ty ĐÃ CÓ (trùng
   *  tax_id/tên) — xem lib/api/companies.ts::createCompany(). */
  companyWasExisting?: boolean;
  /** true = job trả về là job CŨ (trùng company_id + job_title +
   *  level_code + province_name) — mọi dữ liệu vừa gửi bị bỏ, không tạo
   *  job mới (xem JobCreateResult.was_existing). */
  jobWasExisting?: boolean;
}

/** Khớp ĐÚNG comment ở lib/api/jobs.ts::updateJob() — luôn build đủ 4
 *  key con của parsed_content từ state hiện tại của form (GHI ĐÈ TOÀN
 *  BỘ, không merge), không gửi thiếu key nào dù key đó đang rỗng. */
function toParsedContent(payload: JobFormPayload) {
  const skills = payload.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    job_description: payload.description.trim() || null,
    requirements: payload.requirements.trim() || null,
    perks: payload.benefits.trim() || null,
    required_skills: skills.length > 0 ? skills : null,
  };
}

function parseSalary(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed ? Number(trimmed) : null;
}

function validateCommonFields(payload: JobFormPayload): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!payload.jobTitle.trim()) errors.jobTitle = "Vui lòng nhập vị trí tuyển dụng.";
  if (!payload.matchingIndustry.trim()) errors.matchingIndustry = "Vui lòng chọn ngành.";
  return errors;
}

/**
 * POST /jobs (tạo job thủ công) — resolve company TRƯỚC (chọn có sẵn
 * hoặc gọi createCompany() nếu companyField.mode === "new", đúng
 * _resolve_company_id() bên Flask), rồi mới gọi createJob(). CHƯA gọi
 * bởi trang nào ở round 3, viết sẵn cho Round 4 (/them-moi, tab Job).
 */
export async function createJobAction(
  companyField: CompanyFieldValue,
  payload: JobFormPayload,
): Promise<JobActionResult> {
  const fieldErrors = validateCommonFields(payload);
  if (companyField.mode === "existing" && !companyField.companyId) {
    fieldErrors.company = "Vui lòng chọn công ty.";
  }
  if (companyField.mode === "new" && !companyField.companyName.trim()) {
    fieldErrors.newCompanyName = "Vui lòng nhập tên công ty mới.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }

  try {
    let companyId: string;
    let companyWasExisting = false;
    if (companyField.mode === "new") {
      const created = await createCompany({
        companyName: companyField.companyName,
        taxId: companyField.taxId,
        website: companyField.website,
        industry: companyField.industry,
        city: companyField.city,
      });
      companyId = created.company.id;
      companyWasExisting = created.wasExisting;
    } else {
      companyId = companyField.companyId;
    }

    const body: JobCreate = {
      job_title: payload.jobTitle.trim(),
      company_id: companyId,
      matching_industry: payload.matchingIndustry.trim(),
      level_code: payload.levelCode || null,
      province_name: payload.provinceName || null,
      work_type: payload.workType || null,
      currency: payload.currency,
      salary_min: parseSalary(payload.salaryMin),
      salary_max: parseSalary(payload.salaryMax),
      salary_type: payload.salaryType,
      salary_period: payload.salaryPeriod,
      deadline: payload.deadline || null,
      parsed_content: toParsedContent(payload),
    };

    const result = await createJob(body);
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${result.job_id}`);
    return {
      ok: true,
      jobId: result.job_id,
      companyWasExisting,
      jobWasExisting: result.was_existing,
    };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể tạo job, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * PATCH /jobs/{id} — dùng bởi <JobForm mode="edit"> (/jobs/[jobId]/edit,
 * gọi THẬT ở round này). KHÔNG có company_id trong body (đúng quy tắc
 * "PATCH không nhận company_id"). ssTeamNotes LUÔN gửi nguyên giá trị
 * hiện tại của textarea (kể cả rỗng) — field này KHÔNG nằm trong nhóm 4
 * field "gửi null mới xoá được" của JobUpdate, gửi "" (chuỗi rỗng, KHÔNG
 * PHẢI null) mới đúng là xoá ss_team_notes cũ; activityNote (lý do sửa,
 * optional) chỉ gửi khi có nội dung — để trống thì bỏ hẳn field `note`
 * khỏi body thay vì gửi chuỗi rỗng.
 */
export async function updateJobAction(
  jobId: string,
  payload: JobFormPayload,
  ssTeamNotes: string,
  activityNote?: string,
): Promise<JobActionResult> {
  const fieldErrors = validateCommonFields(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }

  const body: JobUpdate = {
    job_title: payload.jobTitle.trim(),
    matching_industry: payload.matchingIndustry.trim(),
    // 4 field nullable-clearable (đúng comment JobUpdate ở lib/api/jobs.ts
    // / types.ts): "" -> null nghĩa là XOÁ giá trị đang có, không phải
    // "giữ nguyên" (giữ nguyên chỉ xảy ra khi KHÔNG gửi field, ở đây
    // <JobForm> luôn hiện + luôn gửi lại cả 4 field này mỗi lần lưu).
    level_code: payload.levelCode || null,
    province_name: payload.provinceName || null,
    work_type: payload.workType || null,
    deadline: payload.deadline || null,
    currency: payload.currency,
    // salary_min/salary_max: "gửi 0 hoặc null cũng là xoá lương" — rỗng
    // ở đây -> null, đúng tinh thần đó.
    salary_min: parseSalary(payload.salaryMin),
    salary_max: parseSalary(payload.salaryMax),
    salary_type: payload.salaryType,
    salary_period: payload.salaryPeriod,
    parsed_content: toParsedContent(payload),
    // Chuỗi rỗng hợp lệ (không phải null) — xoá ss_team_notes cũ nếu
    // staff xoá trắng textarea, KHÔNG bị backend "bỏ qua" như null.
    ss_team_notes: ssTeamNotes.trim(),
  };
  if (activityNote?.trim()) body.note = activityNote.trim();

  try {
    await updateJob(jobId, body);
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/edit`);
    return { ok: true, jobId };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật job, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}
