// lib/api/contacts.ts
// Tương đương crawler_client/contacts.py bên Flask.
//
// Đã làm: list theo company (bảng read-only ở /companies/[companyId]),
// list gộp toàn hệ thống (/contacts, Nhóm 2 Phần 2 mục 1), hard-delete
// (Phần 2 mục 6). CHƯA làm: create/update/status/assign/xoá mềm và
// <ContactForm> — Phần 2 mục 2-5.
//
// TOÀN BỘ route /companies/{id}/contacts yêu cầu require_role("ss_team")
// ở backend (thông tin liên hệ nhạy cảm — email/SĐT cá nhân, khác GET
// /companies công khai) — dùng callAuthed(), KHÔNG callPublic().

import { callAuthed, ApiError } from "./client";
import type { components } from "./types";

export type CompanyContactOut = components["schemas"]["CompanyContactOut"];
/** Như CompanyContactOut nhưng kèm `company_name` — response của GET
 *  /contacts (danh sách gộp toàn hệ thống, Nhóm 2 Phần 2 mục 1). */
export type CompanyContactWithCompanyOut = components["schemas"]["CompanyContactWithCompanyOut"];

/**
 * GET /companies/{company_id}/contacts?include_inactive=true — LUÔN lấy
 * cả contact đã xoá mềm, khớp Y HỆT list_contacts() bên Flask (khác
 * list_all_contacts() dùng cho /contacts — mặc định include_inactive=
 * false, thuộc Phần 2). company_detail.html tách lại active/inactive từ
 * ĐÚNG 1 danh sách này (selectattr/rejectattr is_active) để hiện khối
 * "Đã xoá" gấp lại — trang company detail (Phần 1, read-only) và trang
 * edit (Phần 1, tính gợi ý tiềm năng) đều cần include_inactive=true như
 * nhau, nên không cần tham số riêng ở hàm này.
 */
export async function listContactsByCompany(companyId: string): Promise<CompanyContactOut[]> {
  return callAuthed<CompanyContactOut[]>(
    `/companies/${companyId}/contacts?${new URLSearchParams({ include_inactive: "true" })}`,
  );
}

// --- Phần 2, mục 6 (chat243.txt/chat244.txt): "Xoá hẳn" contact ở trang
// company detail — nút này KHÔNG phụ thuộc <ContactForm> (Phần 2 mục 2,
// đang làm ở phiên khác), chỉ cần đúng endpoint hard-delete + note bắt
// buộc, nên làm độc lập được ngay trong lúc Phần 1/2 vẫn chưa xong.

/**
 * DELETE /companies/{company_id}/contacts/{contact_id}/hard — xoá THẬT,
 * chỉ gọi được sau khi contact đã xoá mềm (is_active=false, xem khối "Đã
 * xoá" ở /companies/[companyId]). note BẮT BUỘC (ContactDeleteRequest —
 * khớp bug backend đã sửa ở Plan_NextJS.md mục 3.12: trước đây route này
 * không nhận note/không ghi log, giờ dùng chung schema với xoá mềm).
 *
 * Backend tự chặn (raise 409) nếu:
 *  - contact vẫn còn active (chưa xoá mềm trước) — error_code
 *    "contact_still_active"
 *  - contact đang có job_contact_links (đã từng gắn job cụ thể) —
 *    error_code "contact_has_links"
 * Cả 2 message backend trả sẵn đã đủ rõ bằng tiếng Việt để hiện thẳng
 * trong <NoteConfirmDialog> (result.message), không cần tự soạn lại.
 */
export async function hardDeleteContact(companyId: string, contactId: string, note: string): Promise<void> {
  await callAuthed<void>(`/companies/${companyId}/contacts/${contactId}/hard`, {
    method: "DELETE",
    body: JSON.stringify({ note }),
  });
}

/** Contact đã bị xoá hẳn/không thuộc công ty này từ trước (vd 2 tab cùng
 *  bấm) — coi là "đã đạt mục tiêu" giống isCompanyNotFound(), không hiện
 *  lỗi khó hiểu cho tình huống vô hại này. */
export function isContactNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

// --- Phần 2, mục 1: /contacts — danh sách gộp toàn hệ thống.

export interface ContactListFilters {
  /** Tìm theo tên contact (khớp 1 phần, không phân biệt hoa/thường). */
  q?: string;
  /** 1 trong CONTACT_STATUS_CODES (mã tiếng Anh, KHÔNG phải nhãn Việt). */
  status?: string;
  company_id?: string;
}

/**
 * GET /contacts — contact gộp mọi công ty, kèm company_name. Khớp
 * list_all_contacts() bên Flask: mặc định CHỈ contact đang active
 * (include_inactive=false — trang này là view "đang cần làm việc", xem
 * lại contact đã xoá mềm vào /companies/[companyId]). Backend KHÔNG
 * phân trang route này (trả thẳng mảng, không có `total`) — giống Flask.
 *
 * created_by/assigned_ss_user (backend có hỗ trợ) chưa dùng ở đây: chỉ
 * phục vụ /staff-activity/[id] (Nhóm 3).
 *
 * Yêu cầu role ss_team -> callAuthed. no-store đã là mặc định của
 * callAuthed (plan Nhóm 2: /contacts KHÔNG cache giữa các lần lọc).
 */
export async function listAllContacts(filters: ContactListFilters = {}): Promise<CompanyContactWithCompanyOut[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("contact_status", filters.status);
  if (filters.company_id) params.set("company_id", filters.company_id);
  if (filters.q) params.set("search", filters.q);
  const qs = params.toString();
  return callAuthed<CompanyContactWithCompanyOut[]>(qs ? `/contacts?${qs}` : "/contacts");
}
