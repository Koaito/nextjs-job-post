// lib/api/companies.ts
// Tương đương crawler_client/companies.py bên Flask.
//
// Nhóm 1, phần 3 (round trước): list/create tối giản cho <CompanyCombobox>.
// Nhóm 2, Phần 1 (round này): thêm list phân trang + get/update/delete +
// partnership-signals cho /companies, /companies/[id], /companies/[id]/edit.
// CHƯA làm: data-health (Nhóm 6, Phần 3).

import { callAuthed, callPublic, ApiError } from "./client";
import type { components } from "./types";

export type CompanyOut = components["schemas"]["CompanyOut"];
export type CompanyDetailOut = components["schemas"]["CompanyDetailOut"];
export type CompanyCreate = components["schemas"]["CompanyCreate"];
export type CompanyCreateResult = components["schemas"]["CompanyCreateResult"];
export type CompanyUpdate = components["schemas"]["CompanyUpdate"];
export type PaginatedCompanies = components["schemas"]["PaginatedCompanies"];
export type PartnershipSignals = components["schemas"]["PartnershipSignals"];

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
  // 5 field thêm ở Nhóm 2, Phần 1 (CompanyCombobox — round trước — chỉ
  // cần 5 field phía trên cho nhánh "＋ Tạo công ty mới…" rút gọn trong
  // JobForm, không gửi field nào dưới đây nên vẫn hoạt động đúng cũ khi
  // không truyền). <CompanyForm> (Phần 1, form đầy đủ ở /them-moi tab
  // "Công ty") dùng đủ 5 field này.
  companySize?: string;
  address?: string;
  fanpageUrl?: string;
  linkedinUrl?: string;
  /** HIGH | MEDIUM | LOW | UNVERIFIED — bỏ trống giữ mặc định UNVERIFIED
   *  của DB, khớp CompanyCreate.partnership_potential. */
  partnershipPotential?: string;
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
    company_size: input.companySize?.trim() || null,
    address: input.address?.trim() || null,
    fanpage_url: input.fanpageUrl?.trim() || null,
    linkedin_url: input.linkedinUrl?.trim() || null,
    partnership_potential: input.partnershipPotential || null,
  };
  const raw = await callAuthed<CompanyCreateResult>("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { company: toCompanyOption(raw), wasExisting: raw.was_existing };
}

// ---------------------------------------------------------------------------
// Nhóm 2, Phần 1 — /companies (list phân trang), /companies/[id] (detail),
// /companies/[id]/edit, sửa nhanh "Tiềm năng" tại bảng danh sách.

export interface CompanyFilters {
  q?: string;
  /** Tên tỉnh/thành — dropdown filter dùng CITIES_VN TĨNH (đã chốt với
   *  user, không gọi round-trip list_company_cities() như Flask), gửi
   *  thẳng lên query `province` (khớp list_companies() bên FastAPI —
   *  lọc theo kiểu chứa chuỗi/ILIKE, không phải enum chặt). */
  city?: string;
}

/** GET /companies (phân trang) — dùng cho bảng /companies. Route PUBLIC,
 *  callPublic giống listAllCompanies(). */
export async function listCompanies(
  filters: CompanyFilters,
  { limit, offset }: { limit: number; offset: number },
): Promise<PaginatedCompanies> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.q) params.set("keyword", filters.q);
  if (filters.city) params.set("province", filters.city);
  return callPublic<PaginatedCompanies>(`/companies?${params.toString()}`);
}

/** GET /companies/{id} (kèm .jobs) — route PUBLIC. company_id sai định
 *  dạng UUID hay không tồn tại đều rơi vào catch -> null, để page.tsx tự
 *  quyết định notFound() — khớp pattern lib/api/jobs.ts::getJob(). */
export async function getCompany(companyId: string): Promise<CompanyDetailOut | null> {
  try {
    return await callPublic<CompanyDetailOut>(`/companies/${companyId}`);
  } catch {
    return null;
  }
}

/**
 * GET /companies/partnership-signals — cho bảng danh sách /companies
 * tính gợi ý "Tiềm năng hợp tác" (xem lib/company-potential.ts). Rỗng
 * -> trả {} luôn KHÔNG gọi API (khớp get_partnership_signals() bên
 * Flask — công ty không có trong dict coi như cả 3 tín hiệu đều false).
 */
export async function getPartnershipSignals(
  companyIds: string[],
): Promise<Record<string, PartnershipSignals>> {
  if (companyIds.length === 0) return {};
  const params = new URLSearchParams();
  for (const id of companyIds) params.append("company_id", id);
  return callPublic<Record<string, PartnershipSignals>>(`/companies/partnership-signals?${params.toString()}`);
}

export interface UpdateCompanyInput {
  companyName?: string;
  taxId?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  address?: string;
  provinceName?: string;
  fanpageUrl?: string;
  linkedinUrl?: string;
  partnershipPotential?: string;
  /** Ghi chú lịch sử thao tác — TUỲ CHỌN (khớp CompanyUpdate.note, khác
   *  DELETE bắt buộc note bên dưới). */
  note?: string;
}

/**
 * PATCH /companies/{id} — sửa TỰ DO field công ty (dùng bởi <CompanyForm
 * mode="edit">) LẪN sửa nhanh "Tiềm năng" tại bảng danh sách (payload tối
 * giản chỉ partnershipPotential + note, xem updateCompanyPotentialAction
 * ở lib/actions/company-actions.ts) — backend vốn đã hỗ trợ partial
 * update thật sự (field không có mặt trong body thì giữ nguyên), nên
 * dùng CHUNG 1 hàm cho cả 2 nơi thay vì viết trùng 2 lần.
 *
 * CHỈ field CÓ MẶT trong `input` (khác undefined) mới đưa vào body — để
 * backend giữ nguyên field không gửi, đúng ngữ nghĩa PATCH.
 *
 * QUAN TRỌNG: khác createCompany() ở trên (input rỗng -> gửi `null`, vì
 * POST dùng update_company_profile() kiểu "vá thêm", field falsy bị bỏ
 * qua nên null/"" như nhau) — patch_company_profile() (PATCH) phân biệt
 * THẬT `None` (field vắng mặt trong body — Pydantic Optional[str]=None
 * áp dụng CẢ CHO json null lẫn field bị lược hẳn, backend không phân
 * biệt được 2 trường hợp này) với `""` (field có mặt, giá trị rỗng có
 * chủ đích — XOÁ giá trị cũ). Nếu hàm này lỡ đổi input rỗng thành `null`
 * như createCompany(), staff xoá trắng 1 ô trong <CompanyForm mode="edit">
 * rồi lưu sẽ ÂM THẦM KHÔNG xoá được gì (backend đọc null y hệt "không
 * gửi", giữ nguyên giá trị cũ) — vì vậy các field string dưới đây gửi
 * THẲNG giá trị đã .trim() (kể cả rỗng), KHÔNG qua `|| null`.
 */
export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
): Promise<CompanyDetailOut> {
  const body: CompanyUpdate = {};
  // companyName không bao giờ rỗng tới đây (company-actions.ts đã chặn ở
  // validateCompanyForm trước khi gọi hàm này) — company_name còn có
  // min_length=1 phía Pydantic, gửi "" sẽ bị 422.
  if (input.companyName !== undefined) body.company_name = input.companyName.trim();
  if (input.taxId !== undefined) body.tax_id = input.taxId.trim();
  if (input.website !== undefined) body.website = input.website.trim();
  if (input.industry !== undefined) body.industry = input.industry.trim();
  if (input.companySize !== undefined) body.company_size = input.companySize.trim();
  if (input.address !== undefined) body.address = input.address.trim();
  if (input.provinceName !== undefined) body.province_name = input.provinceName.trim();
  if (input.fanpageUrl !== undefined) body.fanpage_url = input.fanpageUrl.trim();
  if (input.linkedinUrl !== undefined) body.linkedin_url = input.linkedinUrl.trim();
  // partnership_potential luôn là 1 trong 4 mã hợp lệ (dropdown, không
  // có lựa chọn rỗng) — không cần .trim() falsy-guard.
  if (input.partnershipPotential !== undefined) body.partnership_potential = input.partnershipPotential;
  // note: KHÔNG phải field hồ sơ company cần giữ/xoá như trên — đây là
  // ghi chú cho log thao tác (CompanyUpdate.note, optional), rỗng thì
  // đơn giản là "không ghi chú gì", nên chuyển "" -> undefined (bỏ hẳn
  // khỏi body) thay vì gửi null.
  if (input.note?.trim()) body.note = input.note.trim();

  return callAuthed<CompanyDetailOut>(`/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** DELETE /companies/{id} — xoá MỀM (is_active=false), note BẮT BUỘC
 *  (khớp CompanyDeleteRequest, backend trả 422 nếu thiếu/rỗng). Gọi lại
 *  nhiều lần trên company đã xoá vẫn không lỗi (204), không ghi log
 *  trùng — hành vi backend tự lo, hàm này không cần tự chặn gọi lặp. */
export async function deleteCompany(companyId: string, note: string): Promise<void> {
  await callAuthed<void>(`/companies/${companyId}`, {
    method: "DELETE",
    body: JSON.stringify({ note }),
  });
}

/** Company không tồn tại (404) khi update/delete — nơi gọi (server
 *  action) cần phân biệt lỗi này với lỗi nghiệp vụ khác để hiện thông
 *  báo phù hợp (vd company vừa bị người khác xoá giữa lúc đang sửa). */
export function isCompanyNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
