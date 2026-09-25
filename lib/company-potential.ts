// lib/company-potential.ts
// Port TS của potential_score.py (Flask) — Nhóm 2, Phần 1 của plan.
//
// CHỈ LÀ GỢI Ý — không tự ghi đè partnership_potential trong DB, chỉ
// tính ra 1 badge "🤖 Gợi ý: …" hiển thị cạnh dropdown partnership_potential
// để staff tham khảo, tự quyết định có chấm theo hay không (xem docstring
// gốc potential_score.py).
//
// 2 biến thể dùng CHUNG lõi chấm điểm _scoreCriteria(), khớp đúng 2 hàm
// bên Flask:
//   - suggestPartnershipPotentialFromSignals(): dùng ở /companies (list)
//     — nhận signals đã group sẵn bằng SQL (GET /companies/partnership-
//     signals), KHÔNG cần round-trip riêng cho job/contact.
//   - suggestPartnershipPotentialFull(): dùng ở /companies/[id]/edit —
//     company đã có sẵn .jobs (CompanyDetailOut), cộng contacts lấy riêng
//     (listContactsByCompany).

import type { JobOut } from "@/lib/api/jobs";
import type { CompanyContactOut } from "@/lib/api/contacts";
import { INDUSTRIES } from "@/lib/constants";

// Level "mới ra trường" — khớp level_group 'Entry Level' bên backend
// (Intern/Fresher/Junior). Hard-code giống bản Flask (level_group không
// có trong JobOut, chỉ có level_code) — 3 giá trị này ổn định.
const ENTRY_LEVELS = new Set(["Intern", "Fresher", "Junior"]);

const RESPONDED_STATUSES = new Set(["RESPONDED", "IN_PARTNERSHIP"]);

const HN_HCM = new Set(["Hà Nội", "TP. Hồ Chí Minh"]);

// Ngưỡng quy đổi tổng điểm (0-5) -> mức gợi ý — khớp _HIGH_THRESHOLD/
// _MEDIUM_THRESHOLD bên Flask.
const HIGH_THRESHOLD = 4;
const MEDIUM_THRESHOLD = 2;

export interface PotentialCriterion {
  label: string;
  met: boolean;
}

export interface PotentialSuggestion {
  level: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  maxScore: number;
  criteria: PotentialCriterion[];
}

function scoreCriteria(signals: {
  hasOpenEntryJob: boolean;
  matchesTargetIndustry: boolean;
  isHnHcm: boolean;
  hasResponded: boolean;
  hasCompanySize: boolean;
}): PotentialSuggestion {
  const criteria: PotentialCriterion[] = [
    { label: "Đang có job Intern/Fresher/Junior còn tuyển (OPEN)", met: signals.hasOpenEntryJob },
    {
      label: "Có job thuộc đúng nhóm ngành MindX đào tạo (Code/Data/BA/UI-UX)",
      met: signals.matchesTargetIndustry,
    },
    { label: "Trụ sở/địa điểm tại Hà Nội hoặc TP.HCM", met: signals.isHnHcm },
    { label: "Đã từng có người liên hệ phản hồi hoặc đang hợp tác", met: signals.hasResponded },
    { label: "Đã xác định được quy mô nhân sự", met: signals.hasCompanySize },
  ];

  const score = criteria.reduce((sum, c) => sum + (c.met ? 1 : 0), 0);
  const level = score >= HIGH_THRESHOLD ? "HIGH" : score >= MEDIUM_THRESHOLD ? "MEDIUM" : "LOW";

  return { level, score, maxScore: 5, criteria };
}

/**
 * Biến thể dùng ở trang DANH SÁCH /companies — nhận thẳng 3 tín hiệu
 * boolean đã group sẵn bằng SQL ở backend (GET /companies/partnership-
 * signals), KHÔNG cần list jobs/contacts đầy đủ. 2 tiêu chí còn lại
 * (isHnHcm, hasCompanySize) có sẵn ngay trên CompanyOut (province_name/
 * company_size), không cần join job/contact.
 */
export function suggestPartnershipPotentialFromSignals(
  company: { province_name?: string | null; company_size?: string | null },
  signals: { has_open_entry_job?: boolean; matches_target_industry?: boolean; has_responded?: boolean } | undefined,
): PotentialSuggestion {
  return scoreCriteria({
    hasOpenEntryJob: !!signals?.has_open_entry_job,
    matchesTargetIndustry: !!signals?.matches_target_industry,
    isHnHcm: HN_HCM.has((company.province_name ?? "").trim()),
    hasResponded: !!signals?.has_responded,
    hasCompanySize: !!(company.company_size ?? "").trim(),
  });
}

/**
 * Biến thể dùng ở trang /companies/[id]/edit — company đã có sẵn .jobs
 * (CompanyDetailOut.jobs, KHÔNG tốn round-trip thêm), contacts lấy riêng
 * qua listContactsByCompany() (Phần 1, chỉ đọc — CRUD contact thuộc
 * Phần 2). Không tính suggestion ở trang tạo mới (company vừa tạo chưa
 * có job/contact nào, gợi ý sẽ luôn ra LOW vô nghĩa) — khớp Flask.
 */
export function suggestPartnershipPotentialFull(
  company: { province_name?: string | null; company_size?: string | null },
  jobs: Pick<JobOut, "job_status" | "level_code" | "matching_industry">[],
  contacts: Pick<CompanyContactOut, "contact_status">[],
): PotentialSuggestion {
  const hasOpenEntryJob = jobs.some(
    (j) => j.job_status === "OPEN" && ENTRY_LEVELS.has(j.level_code ?? ""),
  );
  const matchesTargetIndustry = jobs.some((j) =>
    (INDUSTRIES as readonly string[]).includes(j.matching_industry ?? ""),
  );
  const hasResponded = contacts.some((c) => RESPONDED_STATUSES.has(c.contact_status));

  return scoreCriteria({
    hasOpenEntryJob,
    matchesTargetIndustry,
    isHnHcm: HN_HCM.has((company.province_name ?? "").trim()),
    hasResponded,
    hasCompanySize: !!(company.company_size ?? "").trim(),
  });
}
