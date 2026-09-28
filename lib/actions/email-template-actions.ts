"use server";

// lib/actions/email-template-actions.ts
// 3 server action của trang quản trị mẫu email (/contacts/email-templates) —
// plan Nhóm 2: createEmailTemplateAction / updateEmailTemplateAction /
// deleteEmailTemplateAction.
//
// Luật note (plan Nhóm 2, dòng "Xoá 1 mẫu email là hard-delete thật"):
//   CREATE  -> note KHÔNG bắt buộc.
//   UPDATE  -> note BẮT BUỘC vô điều kiện (KHÔNG áp luật "chỉ khi có thay
//              đổi thật" — luật đó chỉ dành cho Contact/Company). Chặn ở
//              cả client (<EmailTemplateForm>) lẫn server action này.
//   DELETE  -> note BẮT BUỘC vô điều kiện, KHÔNG áp luật diff.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  isEmailTemplateNotFound,
  type EmailTemplateInput,
} from "@/lib/api/email-templates";
import { CONTACT_STATUS_CODES } from "@/lib/constants";

const LIST_PATH = "/contacts/email-templates";

export interface EmailTemplateFormActionResult {
  ok: boolean;
  errorMessage?: string;
  /** Lỗi theo từng field — <EmailTemplateForm> tô đỏ tại chỗ + GIỮ NGUYÊN
   *  input (plan Nhóm 1 add_hub: lỗi validate không được reset trắng form). */
  fieldErrors?: Record<string, string>;
}

export interface EmailTemplateNoteActionResult {
  ok: boolean;
  message: string;
}

function validateTemplateInput(input: EmailTemplateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = "Vui lòng nhập tiêu đề mẫu.";
  else if (input.title.trim().length > 255) errors.title = "Tiêu đề tối đa 255 ký tự.";
  // body chỉ coi là rỗng khi toàn khoảng trắng (khớp _body_not_blank ở backend).
  if (!input.body.trim()) errors.body = "Vui lòng nhập nội dung mẫu.";
  if (input.description.trim().length > 500) errors.description = "Mô tả tối đa 500 ký tự.";
  // recommendedFor do checkbox sinh ra nên chỉ sai khi ai đó gọi action trực
  // tiếp với giá trị lạ — chặn sớm thay vì để backend trả 422 khó hiểu.
  const invalid = input.recommendedFor.filter((c) => !(CONTACT_STATUS_CODES as readonly string[]).includes(c));
  if (invalid.length > 0) errors.recommendedFor = "Trạng thái gợi ý không hợp lệ.";
  return errors;
}

/**
 * POST /email-templates. Không redirect — <EmailTemplateForm> tự đóng form
 * + refresh (staff ở lại đúng trang, giống các action contact ở Phần 2).
 */
export async function createEmailTemplateAction(
  input: EmailTemplateInput,
  activityNote?: string,
): Promise<EmailTemplateFormActionResult> {
  const fieldErrors = validateTemplateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }
  try {
    await createEmailTemplate(input, activityNote);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể thêm mẫu email, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * PATCH /email-templates/{id}. Message lỗi backend (422 thiếu note...) được
 * trả nguyên ra form. Mẫu đã bị xoá ở tab khác (404) -> báo rõ thay vì coi
 * là thành công (khác delete: sửa 1 mẫu không còn tồn tại KHÔNG đạt mục
 * tiêu của staff).
 */
export async function updateEmailTemplateAction(
  templateId: string,
  input: EmailTemplateInput,
  activityNote: string,
): Promise<EmailTemplateFormActionResult> {
  const fieldErrors = validateTemplateInput(input);
  // Note tự .trim() và chặn rỗng trước khi gọi API (plan dòng 192).
  if (!activityNote.trim()) fieldErrors.activityNote = "Vui lòng nhập lý do sửa.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, errorMessage: "Vui lòng kiểm tra lại các trường còn thiếu." };
  }
  try {
    await updateEmailTemplate(templateId, input, activityNote);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    if (isEmailTemplateNotFound(err)) {
      revalidatePath(LIST_PATH);
      return { ok: false, errorMessage: "Không tìm thấy mẫu email cần sửa (có thể đã bị xoá)." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật mẫu email, thử lại sau.";
    return { ok: false, errorMessage: message };
  }
}

/**
 * DELETE /email-templates/{id} — xoá HẲN, note bắt buộc vô điều kiện, tự
 * .trim() và chặn note rỗng trước khi gọi API (plan dòng 192). 404 (đã bị
 * xoá ở tab khác) coi là thành công — mục tiêu cuối (mẫu không còn) đã đạt,
 * cùng cách deleteContactAction().
 */
export async function deleteEmailTemplateAction(
  templateId: string,
  note: string,
): Promise<EmailTemplateNoteActionResult> {
  if (!note.trim()) {
    return { ok: false, message: "Xoá mẫu email bắt buộc phải nhập ghi chú lý do." };
  }
  try {
    await deleteEmailTemplate(templateId, note.trim());
  } catch (err) {
    if (!isEmailTemplateNotFound(err)) {
      const message = err instanceof ApiError ? err.message : "Không thể xoá mẫu email, thử lại sau.";
      return { ok: false, message };
    }
  }
  revalidatePath(LIST_PATH);
  return { ok: true, message: "Đã xoá mẫu email." };
}
