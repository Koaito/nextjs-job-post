// lib/api/contacts.ts
// Tương đương crawler_client/contacts.py bên Flask — CHỈ làm phần ĐỌC
// (list theo company) cần cho bảng contact READ-ONLY ở
// /companies/[companyId] (Nhóm 2, Phần 1 — quyết định đã chốt với user:
// "Hiện bảng contact read-only, không sửa/xoá/assign"). CHƯA làm: create/
// update/status/assign/delete/hard-delete, trang /contacts (danh sách gộp
// toàn hệ thống), <ContactForm> — thuộc Nhóm 2, Phần 2 (chưa tới lượt).
//
// TOÀN BỘ route /companies/{id}/contacts yêu cầu require_role("ss_team")
// ở backend (thông tin liên hệ nhạy cảm — email/SĐT cá nhân, khác GET
// /companies công khai) — dùng callAuthed(), KHÔNG callPublic().

import { callAuthed } from "./client";
import type { components } from "./types";

export type CompanyContactOut = components["schemas"]["CompanyContactOut"];

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
