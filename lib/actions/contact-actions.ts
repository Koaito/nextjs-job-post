"use server";

// lib/actions/contact-actions.ts
// Phần 2: mục 2 (createContactAction/updateContactAction cho <ContactForm>)
// và mục 6 (hardDeleteContactAction, nút "Xoá hẳn" ở /companies/[companyId]).
// mục 3 (updateContactStatusAction/assignContactAction cho 2 cell đổi tại
// chỗ). CHƯA làm: deleteContact (soft) — Phần 2 mục 5.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { createCompany } from "@/lib/api/companies";
import {
  createContact,
  updateContact,
  updateContactStatus,
  assignContact,
  hardDeleteContact,
  isContactNotFound,
  type ContactInput,
} from "@/lib/api/contacts";
import { CONTACT_STATUS_CODES } from "@/lib/constants";
import type { CompanyFieldValue } from "@/components/company-combobox";

export interface ContactNoteActionResult {
  ok: boolean;
  message: string;
}

/**
 * DELETE /companies/{company_id}/contacts/{contact_id}/hard — note BẮT
 * BUỘC (khớp <NoteConfirmDialog noteRequired>, cùng pattern
 * deleteCompanyAction()). Trả thẳng message lỗi từ backend khi 409
 * (contact_still_active / contact_has_links) — 2 message đó đã đủ rõ
 * bằng tiếng Việt để hiện trong dialog, không cần tự soạn lại.
 */
export async function hardDeleteContactAction(
  companyId: string,
  contactId: string,
  note: string,
): Promise<ContactNoteActionResult> {
  try {
    await hardDeleteContact(companyId, contactId, note);
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã xoá hẳn người liên hệ." };
  } catch (err) {
    if (isContactNotFound(err)) {
      revalidatePath(`/companies/${companyId}`);
      return { ok: true, message: "Đã xoá hẳn người liên hệ." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể xoá hẳn người liên hệ, thử lại sau.";
    return { ok: false, message };
  }
}

export interface ContactFormActionResult {
  ok: boolean;
  errorMessage?: string;
  /** Lỗi theo từng field — <ContactForm> tô đỏ tại chỗ + giữ nguyên input. */
  fieldErrors?: Record<string, string>;
  companyId?: string;
  /** true = công ty vừa "tạo mới" thật ra đã tồn tại (trùng tax_id/tên) —
   *  nơi gọi phải báo "đã tìm thấy công ty trùng", không nói "đã tạo". */
  companyWasExisting?: boolean;
}

function validateContactForm(input: ContactInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.contactName.trim()) errors.contactName = "Vui lòng nhập tên người liên hệ.";
  return errors;
}

/**
 * POST /companies/{company_id}/contacts — dùng bởi <ContactForm mode="create">
 * (tab "Người liên hệ" ở /them-moi). Khớp contacts.add_any() bên Flask:
 * company bắt buộc ("Cần chọn công ty."). Khác Flask ở chỗ combobox có chế
 * độ "＋ Tạo công ty mới…" (plan Nhóm 1) -> resolve company TRƯỚC (gọi
 * createCompany(), idempotent theo tax_id/tên — cùng cách createJobAction()),
 * rồi mới tạo contact. Nếu bước tạo contact lỗi thì company đã tạo vẫn còn
 * (vô hại: bấm Lưu lại sẽ khớp đúng công ty đó, không tạo trùng).
 */
export async function createContactAction(
  companyField: CompanyFieldValue,
  input: ContactInput,
  activityNote?: string,
): Promise<ContactFormActionResult> {
  const fieldErrors = validateContactForm(input);
  if (companyField.mode === "existing" && !companyField.companyId) {
    fieldErrors.company = "Vui lòng chọn công ty.";
  }
  if (companyField.mode === "new" && !companyField.companyName.trim()) {
    fieldErrors.company = "Vui lòng nhập tên công ty.";
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
      revalidatePath("/companies");
    } else {
      companyId = companyField.companyId;
    }

    await createContact(companyId, input, activityNote);
    revalidatePath("/contacts");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, companyId, companyWasExisting };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể thêm người liên hệ, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * PATCH /companies/{company_id}/contacts/{contact_id} — dùng bởi
 * <ContactForm mode="edit">. note BẮT BUỘC khi có field thật sự đổi:
 * <ContactForm> đã tự chặn ở client (chỉ đòi khi khác giá trị gốc), backend
 * vẫn là lớp chặn cuối (422) — message backend được trả nguyên ra form.
 */
export async function updateContactAction(
  companyId: string,
  contactId: string,
  input: ContactInput,
  activityNote: string,
): Promise<ContactFormActionResult> {
  const fieldErrors = validateContactForm(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }
  try {
    await updateContact(companyId, contactId, input, activityNote);
    revalidatePath("/contacts");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, companyId };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật người liên hệ, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * Đổi trạng thái liên hệ tại chỗ (cell ở /contacts và /companies/[id]).
 * note BẮT BUỘC khi status thật sự đổi — <ContactStatusCell> đã tự chỉ cho
 * gửi khi có đổi + có note; backend vẫn chặn cứng (422). Message lỗi backend
 * (tiếng Việt) trả nguyên ra dialog.
 *
 * revalidatePath cho 2 trang chứa cell; cell tự router.refresh() để cả
 * trang thứ 3 (vd /staff-activity/[id] sau này) cũng lấy dữ liệu mới.
 */
export async function updateContactStatusAction(
  companyId: string,
  contactId: string,
  status: string,
  note: string,
): Promise<ContactNoteActionResult> {
  if (!(CONTACT_STATUS_CODES as readonly string[]).includes(status)) {
    return { ok: false, message: "Trạng thái không hợp lệ." };
  }
  try {
    await updateContactStatus(companyId, contactId, status, note);
    revalidatePath("/contacts");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã cập nhật trạng thái liên hệ." };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái, thử lại sau.";
    return { ok: false, message };
  }
}

/**
 * Gán/đổi/bỏ gán người phụ trách tại chỗ. assigneeId "" = bỏ gán — vẫn
 * truyền xuống assignContact() (luôn gửi field, plan dòng 989).
 */
export async function assignContactAction(
  companyId: string,
  contactId: string,
  assigneeId: string,
  note: string,
): Promise<ContactNoteActionResult> {
  try {
    await assignContact(companyId, contactId, assigneeId, note);
    revalidatePath("/contacts");
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã cập nhật người phụ trách." };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật người phụ trách, thử lại sau.";
    return { ok: false, message };
  }
}
