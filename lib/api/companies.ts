// lib/api/companies.ts
// Tương đương crawler_client/companies.py bên Flask — CHỈ làm phần
// list/create cần cho <CompanyCombobox> (Nhóm 1, phần 3) ở round này.
// CHƯA làm: update/delete/partnership-signals/data-health/potential
// (thuộc Nhóm 2 — trang quản lý công ty đầy đủ).

import { callAuthed, callPublic } from "./client";
import type { components } from "./types";

export type CompanyOut = components["schemas"]["CompanyOut"];
export type CompanyCreate = components["schemas"]["CompanyCreate"];
export type CompanyCreateResult = components["schemas"]["CompanyCreateResult"];
export type PaginatedCompanies = components["schemas"]["PaginatedCompanies"];

export interface CompanyOption {
  id: string;
  name: string;
  taxId: string;
}

function toCompanyOption(c: CompanyOut): CompanyOption {
  return { id: c.company_id, name: c.company_name, taxId: c.tax_id ?? "" };
}

// Backend giới hạn limit<=200/lần gọi GET /companies (api/routers/
// companies.py: Query(..., le=200)) — gọi thẳng limit lớn hơn sẽ bị
// 422. _ALL_COMPANIES_SAFETY_CAP chặn vòng lặp vô hạn nếu `total`
// backend trả sai, khớp _ALL_COMPANIES_SAFETY_CAP=5000 bên Flask
// (crawler_client/companies.py::list_all_companies()).
const MAX_COMPANIES_PAGE = 200;
const ALL_COMPANIES_SAFETY_CAP = 5000;

/**
 * Khớp list_all_companies() bên Flask: tự phân trang gom TOÀN BỘ công
 * ty active thành 1 mảng — dùng cho <CompanyCombobox> (cần thấy hết để
 * gõ-lọc tại chỗ, không phải danh sách phân trang kiểu bảng /companies
 * ở Nhóm 2). GET /companies là route PUBLIC (không cần đăng nhập,
 * giống GET /jobs) nên dùng callPublic, KHÔNG callAuthed.
 */
export async function listAllCompanies(): Promise<CompanyOption[]> {
  const all: CompanyOption[] = [];
  // Vòng đầu cần biết `total` để biết khi nào dừng — gọi 1 trang trước
  // rồi mới quyết định có lặp tiếp hay không, thay vì đoán trước số
  // vòng lặp.
  const first = await callPublic<PaginatedCompanies>(
    `/companies?${new URLSearchParams({ limit: String(MAX_COMPANIES_PAGE), offset: "0" })}`,
  );
  all.push(...first.items.map(toCompanyOption));
  const total = first.total;
  let offset = MAX_COMPANIES_PAGE;
  while (offset < total && offset < ALL_COMPANIES_SAFETY_CAP) {
    const page = await callPublic<PaginatedCompanies>(
      `/companies?${new URLSearchParams({ limit: String(MAX_COMPANIES_PAGE), offset: String(offset) })}`,
    );
    if (page.items.length === 0) break;
    all.push(...page.items.map(toCompanyOption));
    offset += MAX_COMPANIES_PAGE;
  }
  return all;
}

export interface CreateCompanyInput {
  companyName: string;
  taxId?: string;
  website?: string;
  industry?: string;
  city?: string;
}

/**
 * Kết quả tạo công ty, kèm `wasExisting` lấy THẲNG từ backend
 * (POST /companies trả CompanyCreateResult.was_existing — Phần 5 mục 16
 * của plan, Scrap_JD đã làm). true = công ty trả về đã có từ trước
 * (trùng tax_id hoặc tên), request này chỉ vá thêm thông tin, KHÔNG tạo
 * bản ghi mới -> nơi gọi (nhánh "＋ Tạo công ty mới…" của JobForm, tab
 * Công ty ở /them-moi) phải báo rõ cho staff thay vì nói "đã tạo".
 *
 * Trước đây hàm này phải đoán theo tax_id trong danh sách công ty đã tải
 * (không đoán được theo tên) vì backend chưa có field này — đã bỏ, và
 * `wasExisting` giờ luôn là boolean thật (không còn trạng thái "không
 * rõ" = undefined).
 */
export interface CreateCompanyResult {
  company: CompanyOption;
  wasExisting: boolean;
}

export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const payload: CompanyCreate = {
    company_name: input.companyName.trim(),
    tax_id: input.taxId?.trim() || null,
    website: input.website?.trim() || null,
    industry: input.industry?.trim() || null,
    province_name: input.city?.trim() || null,
  };
  const raw = await callAuthed<CompanyCreateResult>("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { company: toCompanyOption(raw), wasExisting: raw.was_existing };
}
