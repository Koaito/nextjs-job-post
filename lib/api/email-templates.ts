// lib/api/email-templates.ts
// Tương đương crawler_client/email_templates.py bên Flask — Nhóm 2, Phần 3
// (CRUD mẫu email ở /contacts/email-templates + popup <EmailTemplatePickerModal>).
//
// TOÀN BỘ route /email-templates yêu cầu require_role("ss_team") ở backend
// -> dùng callAuthed(), KHÔNG callPublic(). no-store là mặc định của
// callAuthed (plan Nhóm 2: trang quản trị mẫu email không cache).
//
// XOÁ HẲN (hard delete, KHÁC hẳn company/contact vốn soft-delete) — plan
// Nhóm 2: không cần UI "khôi phục", chỉ cần xác nhận thông thường.
// note: CREATE không bắt buộc; UPDATE/DELETE bắt buộc vô điều kiện (KHÔNG áp
// luật "chỉ khi có thay đổi thật" — luật đó chỉ dành cho Contact/Company).

import { callAuthed, ApiError } from "./client";
import type { components } from "./types";

export type EmailTemplateOut = components["schemas"]["EmailTemplateOut"];
type EmailTemplateCreate = components["schemas"]["EmailTemplateCreate"];
type EmailTemplateUpdate = components["schemas"]["EmailTemplateUpdate"];

/** Field nhập tay của form thêm/sửa mẫu (camelCase, giống ContactInput). */
export interface EmailTemplateInput {
  title: string;
  description: string;
  body: string;
  /** Mã trạng thái contact (CONTACT_STATUS_CODES), KHÔNG phải nhãn Việt. */
  recommendedFor: string[];
  /** Chuỗi (giữ nguyên thứ người dùng gõ) — parse số ở nơi build payload. */
  displayOrder: string;
}

/** "" / không phải số nguyên -> 0, khớp int(form.get("display_order") or 0)
 *  của Flask (Flask sẽ văng ValueError nếu gõ "abc"; ở đây form dùng
 *  <input type="number"> nên hiếm, coi như 0 thay vì hỏng cả thao tác). */
function parseDisplayOrder(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /email-templates — danh sách đầy đủ, backend đã sắp theo
 * display_order. 1 nguồn dữ liệu duy nhất cho CẢ popup chọn mẫu LẪN trang
 * quản lý mẫu (giống Flask).
 */
export async function listEmailTemplates(): Promise<EmailTemplateOut[]> {
  return (await callAuthed<EmailTemplateOut[]>("/email-templates")) ?? [];
}

/**
 * GET /email-templates/{id} — nạp sẵn dữ liệu cũ khi mở form Sửa. Trả null
 * nếu không tồn tại/UUID sai (đã xoá hoặc gõ tay URL) — nơi gọi tự hiện
 * thông báo, khớp `get_email_template()` trả None bên Flask.
 */
export async function getEmailTemplate(templateId: string): Promise<EmailTemplateOut | null> {
  try {
    return await callAuthed<EmailTemplateOut>(`/email-templates/${encodeURIComponent(templateId)}`);
  } catch (err) {
    // 404 (không có) và 400 (không đúng định dạng UUID — vd gõ tay
    // ?edit=abc) đều quy về "không tìm thấy", khớp cách Flask xử lý.
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

/**
 * GET /email-templates/placeholder-help — chú giải các placeholder hợp lệ
 * ({{LOI_CHAO}}...). Plan: KHÔNG hard-code danh sách ở Next.js (tránh lệch
 * khi backend thêm placeholder mới). Lỗi bị nuốt, trả {} — khớp
 * get_placeholder_help() của Flask ("không chặn form hiển thị chỉ vì
 * thiếu phần chú giải phụ này").
 */
export async function getPlaceholderHelp(): Promise<Record<string, string>> {
  try {
    const raw = await callAuthed<components["schemas"]["PlaceholderHelpOut"]>("/email-templates/placeholder-help");
    return raw?.placeholders ?? {};
  } catch {
    return {};
  }
}

/**
 * POST /email-templates. note TUỲ CHỌN. description trống -> null (khớp
 * `or None` của Flask).
 */
export async function createEmailTemplate(input: EmailTemplateInput, note?: string): Promise<EmailTemplateOut> {
  const payload: EmailTemplateCreate = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    body: input.body,
    recommended_for: input.recommendedFor,
    display_order: parseDisplayOrder(input.displayOrder),
    note: note?.trim() || null,
  };
  return callAuthed<EmailTemplateOut>("/email-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * PATCH /email-templates/{id}. Gửi đủ 5 field ghi được (khớp
 * update_email_template() bên Flask — form luôn render đủ toàn bộ field).
 *
 * Lưu ý: backend coi `description = null` là "không gửi/giữ nguyên" nên
 * xoá trắng mô tả rồi lưu KHÔNG xoá được mô tả cũ — cùng hạn chế của Flask
 * (form hiện dòng báo cho staff biết). recommended_for thì gửi được mảng
 * rỗng (= bỏ hết gợi ý) vì backend chỉ bỏ qua khi là null.
 *
 * note BẮT BUỘC vô điều kiện (plan Nhóm 2) — <EmailTemplateForm> và
 * updateEmailTemplateAction đã chặn note rỗng trước khi tới đây.
 */
export async function updateEmailTemplate(
  templateId: string,
  input: EmailTemplateInput,
  note?: string,
): Promise<EmailTemplateOut> {
  const payload: EmailTemplateUpdate = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    body: input.body,
    recommended_for: input.recommendedFor,
    display_order: parseDisplayOrder(input.displayOrder),
    note: note?.trim() || null,
  };
  return callAuthed<EmailTemplateOut>(`/email-templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * DELETE /email-templates/{id} — XOÁ HẲN. note BẮT BUỘC vô điều kiện
 * (EmailTemplateDeleteRequest.note, 422 nếu thiếu).
 */
export async function deleteEmailTemplate(templateId: string, note: string): Promise<void> {
  await callAuthed<void>(`/email-templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
    body: JSON.stringify({ note }),
  });
}

/** Mẫu đã bị xoá ở tab khác (404) — coi là "đã đạt mục tiêu", giống
 *  isContactNotFound()/isCompanyNotFound(). */
export function isEmailTemplateNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
