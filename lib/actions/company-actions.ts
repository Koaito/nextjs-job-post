"use server";

// lib/actions/company-actions.ts
// Server Action cho <CompanyForm> (Nhóm 2, Phần 1) — cùng pattern
// lib/actions/job-actions.ts (KHÔNG qua Route Handler, gọi thẳng
// lib/api/companies.ts).

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import {
  createCompany,
  updateCompany,
  deleteCompany,
  isCompanyNotFound,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "@/lib/api/companies";
import { COMPANY_SIZE_PATTERN } from "@/lib/constants";

export interface CompanyFormPayload {
  companyName: string;
  taxId: string;
  website: string;
  industry: string;
  companySize: string;
  address: string;
  provinceName: string;
  fanpageUrl: string;
  linkedinUrl: string;
  partnershipPotential: string;
}

export interface CompanyActionResult {
  ok: boolean;
  errorMessage?: string;
  /** Lỗi theo từng field — <CompanyForm> tô đỏ tại chỗ + giữ nguyên
   *  input đã nhập, cùng cơ chế JobForm đang dùng. */
  fieldErrors?: Record<string, string>;
  companyId?: string;
  /** true = công ty trả về đã tồn tại từ trước (trùng tax_id/tên) — nơi
   *  gọi (tab "Công ty" ở /them-moi) phải báo rõ "đã tìm thấy công ty
   *  trùng", không nói "đã tạo" (Phần 5 mục 16 của plan). */
  wasExisting?: boolean;
}

/** company_size không có enum cố định để chặn hoàn toàn phía backend
 *  (khớp comment CompanyUpdate ở backend) — validate lại Ở ĐÂY (ngoài
 *  validate client-side của <CompanyForm>) là lớp phòng thủ thứ 2, đề
 *  phòng JS bị tắt/form gửi trực tiếp. */
function validateCompanyForm(payload: CompanyFormPayload): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!payload.companyName.trim()) errors.companyName = "Vui lòng nhập tên công ty.";
  const size = payload.companySize.trim();
  if (size && !COMPANY_SIZE_PATTERN.test(size)) {
    errors.companySize = "Chỉ nhập số và dấu gạch ngang (VD: 100-200, 500).";
  }
  return errors;
}

/**
 * POST /companies — dùng bởi <CompanyForm mode="create"> ở /them-moi (tab
 * "Công ty", Phần 1 — quyết định đã chốt: gắn luôn, không để riêng). Khớp
 * plan (dòng 995): KHÔNG có route /companies/add riêng, tab "Công ty" ở
 * /them-moi gọi thẳng action này.
 */
export async function createCompanyAction(payload: CompanyFormPayload): Promise<CompanyActionResult> {
  const fieldErrors = validateCompanyForm(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }

  const input: CreateCompanyInput = {
    companyName: payload.companyName,
    taxId: payload.taxId,
    website: payload.website,
    industry: payload.industry,
    city: payload.provinceName,
    companySize: payload.companySize,
    address: payload.address,
    fanpageUrl: payload.fanpageUrl,
    linkedinUrl: payload.linkedinUrl,
    partnershipPotential: payload.partnershipPotential || undefined,
  };

  try {
    const result = await createCompany(input);
    revalidatePath("/companies");
    revalidatePath(`/companies/${result.company.id}`);
    return { ok: true, companyId: result.company.id, wasExisting: result.wasExisting };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể tạo công ty, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * PATCH /companies/{id} — dùng bởi <CompanyForm mode="edit">
 * (/companies/[companyId]/edit). activityNote TUỲ CHỌN, khớp
 * CompanyUpdate.note.
 */
export async function updateCompanyAction(
  companyId: string,
  payload: CompanyFormPayload,
  activityNote?: string,
): Promise<CompanyActionResult> {
  const fieldErrors = validateCompanyForm(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }

  const input: UpdateCompanyInput = {
    companyName: payload.companyName,
    taxId: payload.taxId,
    website: payload.website,
    industry: payload.industry,
    companySize: payload.companySize,
    address: payload.address,
    provinceName: payload.provinceName,
    fanpageUrl: payload.fanpageUrl,
    linkedinUrl: payload.linkedinUrl,
    partnershipPotential: payload.partnershipPotential,
  };
  if (activityNote?.trim()) input.note = activityNote.trim();

  try {
    await updateCompany(companyId, input);
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/companies/${companyId}/edit`);
    return { ok: true, companyId };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật công ty, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

export interface CompanyNoteActionResult {
  ok: boolean;
  message: string;
}

/**
 * Sửa nhanh "Tiềm năng" tại bảng danh sách /companies — payload TỐI GIẢN
 * (chỉ partnership_potential + note tuỳ chọn), KHÔNG dùng chung
 * updateCompanyAction() ở trên (hàm đó luôn gửi kèm companyName — nếu
 * gọi từ popover chỉ có 2 field sẽ phải giả lập companyName cũ, dễ lệch
 * nếu ai đó vừa sửa company ở tab khác). Trả {ok, message} khớp interface
 * <NoteConfirmDialog> cần (onConfirm).
 */
export async function updateCompanyPotentialAction(
  companyId: string,
  potential: string,
  note: string,
): Promise<CompanyNoteActionResult> {
  try {
    await updateCompany(companyId, {
      partnershipPotential: potential,
      note: note.trim() || undefined,
    });
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã cập nhật tiềm năng hợp tác." };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật tiềm năng hợp tác.";
    return { ok: false, message };
  }
}

/**
 * DELETE /companies/{id} — xoá mềm, note BẮT BUỘC (khớp
 * <NoteConfirmDialog noteRequired>). Company vừa bị người khác xoá giữa
 * lúc đang mở trang (404) vẫn coi là "xoá thành công" ở phía staff đang
 * bấm (mục tiêu cuối cùng — company không còn active — đã đạt), tránh
 * hiện lỗi khó hiểu cho 1 tình huống vô hại.
 */
export async function deleteCompanyAction(
  companyId: string,
  note: string,
): Promise<CompanyNoteActionResult> {
  try {
    await deleteCompany(companyId, note);
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã xoá công ty." };
  } catch (err) {
    if (isCompanyNotFound(err)) {
      revalidatePath("/companies");
      return { ok: true, message: "Đã xoá công ty." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể xoá công ty, thử lại sau.";
    return { ok: false, message };
  }
}
