// lib/api/companies.ts
// Tương đương crawler_client/companies.py bên Flask — CHỈ làm phần
// list/create cần cho <CompanyCombobox> (Nhóm 1, phần 3) ở round này.
// CHƯA làm: update/delete/partnership-signals/data-health/potential
// (thuộc Nhóm 2 — trang quản lý công ty đầy đủ).

import { callAuthed, callPublic } from "./client";
import type { components } from "./types";

export type CompanyOut = components["schemas"]["CompanyOut"];
export type CompanyCreate = components["schemas"]["CompanyCreate"];
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
 * Kết quả tạo công ty, kèm `wasExisting` — LƯU Ý: field này là suy
 * đoán ở tầng FE, KHÔNG phải dữ liệu backend trả về thật. Backend
 * hiện tại (POST /companies) KHÔNG trả field nào báo hiệu "đây là
 * công ty vừa tạo mới hay là công ty cũ được vá thêm thông tin" — xem
 * lib/api/types.ts::CompanyCreate/CompanyOut, không có `was_existing`.
 * Plan (Phần 5 mục 16) có đề xuất backend bổ sung field này nhưng ghi
 * rõ "Không chặn go-live — thiếu field này Next.js vẫn hoạt động
 * đúng, chỉ là thông báo kém chính xác hơn mức có thể".
 *
 * Vì vậy hàm này chỉ đoán `wasExisting: true` bằng 1 tín hiệu gián
 * tiếp DUY NHẤT đáng tin: tax_id gõ vào có khớp với 1 company ĐÃ CÓ
 * SẴN trong danh sách công ty đã tải (companies truyền vào, cùng
 * nguồn listAllCompanies() dùng cho CompanyCombobox) TRƯỚC KHI gọi
 * tạo. Không đoán được theo TÊN trùng (backend so khớp tên "không
 * phân biệt hoa/thường, khớp y hệt" — làm lại đúng luật so khớp đó ở
 * FE là trùng lặp logic dễ lệch, trong khi tax_id so khớp tuyệt đối
 * đơn giản và an toàn hơn). Nếu tax_id để trống hoặc không khớp company
 * nào đã biết, `wasExisting` trả về `undefined` — nghĩa là "không rõ",
 * KHÔNG mặc định là `false`, để nơi gọi hiện đúng thông báo trung lập
 * thay vì khẳng định nhầm "đã tạo mới" trong lúc thực ra có thể đã
 * trùng theo TÊN (trường hợp FE không đoán được).
 */
export interface CreateCompanyResult {
  company: CompanyOption;
  wasExisting: boolean | undefined;
}

export async function createCompany(
  input: CreateCompanyInput,
  knownCompanies: CompanyOption[],
): Promise<CreateCompanyResult> {
  const taxId = input.taxId?.trim() || undefined;
  const payload: CompanyCreate = {
    company_name: input.companyName.trim(),
    tax_id: taxId ?? null,
    website: input.website?.trim() || null,
    industry: input.industry?.trim() || null,
    province_name: input.city?.trim() || null,
  };
  const raw = await callAuthed<CompanyOut>("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const wasExisting = taxId
    ? knownCompanies.some((c) => c.taxId && c.taxId === taxId)
    : undefined;

  return { company: toCompanyOption(raw), wasExisting };
}
