// lib/audit-changes.ts
// Chuyển trường `changes` của AuditLogOut ({field: {old, new}}) thành các
// dòng hiển thị "tên trường: cũ -> mới" — Nhóm 3, Đợt 3.4, Phần 5/5.
// Hàm THUẦN (không React, không gọi API) để test được. Tính năng MỚI, bản
// Flask không hiện `changes`.
//
// Backend (db.diff_changed_fields) chỉ ghi field THỰC SỰ đổi giá trị. Cần
// biết 2 điều khi đọc:
//  - `changes` có ở UPDATE_*, và CẢ ở ASSIGN_CONTACT (field assigned_ss_user,
//    giá trị là ss_user_id) lẫn DELETE_JOB khi đóng JD kèm sửa field khác —
//    tài liệu API ghi "chỉ UPDATE_*" nhưng code backend thì không, nên hiển
//    thị theo "có changes" chứ không theo action_type.
//  - Log MERGE_JOB (gộp job trùng) có `changes` KHÔNG theo dạng {field: {old,
//    new}} (merged_into, snapshot, merged_from...): các khoá đó chuyển sang
//    lib/audit-merge.ts, trả về dòng kind="info" (chỉ một giá trị, không có
//    "cũ -> mới"). Cột job_postings đổi ở log của job giữ vẫn đi đường cũ.
//  - Giá trị là JSON bất kỳ (chuỗi/số/bool/null/mảng/object, ngày dạng chuỗi
//    do default=str). Không giả định kiểu: gặp dạng lạ thì in JSON thô,
//    không để trang vỡ.

import {
  CONTACT_STATUS_LABELS,
  JOB_STATUS_LABELS,
  PARTNERSHIP_POTENTIAL_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_TYPE_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/constants";
import { formatDateVN } from "@/lib/date";
import { MERGE_INFO_KEYS, buildMergeRows } from "@/lib/audit-merge";

/** Nhãn tên trường THEO entity_type — `job_title` là "Tiêu đề JD" ở JD nhưng
 *  là "Chức danh" ở người liên hệ, nên không dùng được 1 bảng chung. */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  JOB: {
    job_title: "Tiêu đề JD",
    matching_industry: "Ngành",
    level_code: "Cấp bậc",
    province_name: "Tỉnh/thành",
    work_type: "Hình thức làm việc",
    currency: "Đơn vị tiền",
    salary_min: "Lương tối thiểu",
    salary_max: "Lương tối đa",
    salary_type: "Kiểu lương",
    salary_period: "Chu kỳ lương",
    deadline: "Hạn nộp",
    job_status: "Trạng thái",
    ss_team_notes: "Ghi chú nội bộ SS",
    // Các cột log MERGE_JOB của job giữ có thể ghi (db/job_merge.py::
    // _WRITABLE_JOB_COLUMNS). level_id là UUID nên chỉ có nhãn, không có tên cấp bậc.
    source_url: "Link tin gốc",
    level_id: "Cấp bậc (mã nội bộ)",
    level_source: "Nguồn xác định cấp bậc",
    level_rule_version: "Phiên bản luật cấp bậc",
    level_signals: "Tín hiệu suy ra cấp bậc",
    "parsed_content.job_description": "Mô tả công việc",
    "parsed_content.requirements": "Yêu cầu",
    "parsed_content.perks": "Quyền lợi",
    "parsed_content.required_skills": "Kỹ năng yêu cầu",
  },
  COMPANY: {
    company_name: "Tên công ty",
    tax_id: "Mã số thuế",
    website: "Website",
    industry: "Lĩnh vực",
    company_size: "Quy mô nhân sự",
    address: "Địa chỉ",
    province_name: "Tỉnh/thành",
    fanpage_url: "Fanpage",
    linkedin_url: "LinkedIn",
    partnership_potential: "Tiềm năng hợp tác",
  },
  CONTACT: {
    contact_name: "Tên",
    job_title: "Chức danh",
    work_email: "Email công việc",
    social_link: "Link mạng xã hội",
    phone_number: "Số điện thoại",
    found_source: "Nguồn tìm thấy",
    contact_status: "Trạng thái liên hệ",
    last_contacted_date: "Ngày liên hệ gần nhất",
    assigned_ss_user: "Người phụ trách",
  },
  EMAIL_TEMPLATE: {
    title: "Tiêu đề mẫu",
    description: "Mô tả",
    body: "Nội dung",
    recommended_for: "Gợi ý dùng cho",
    display_order: "Thứ tự hiển thị",
  },
};

/** Giá trị enum -> nhãn tiếng Việt, theo tên trường. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  job_status: JOB_STATUS_LABELS,
  work_type: WORK_TYPE_LABELS,
  salary_type: SALARY_TYPE_LABELS,
  salary_period: SALARY_PERIOD_LABELS,
  partnership_potential: PARTNERSHIP_POTENTIAL_LABELS,
  contact_status: CONTACT_STATUS_LABELS,
};

const DATE_FIELDS = new Set(["deadline", "last_contacted_date"]);
const NUMBER_FIELDS = new Set(["salary_min", "salary_max"]);

export interface ChangeRow {
  /** "diff" = thay đổi cũ -> mới. "info" = chỉ một giá trị thông tin (nằm ở
   *  `new`, `old` luôn trống) — dùng cho log MERGE_JOB, nơi không có "cũ -> mới". */
  kind: "diff" | "info";
  /** Khoá thô (vd "salary_min"), dùng làm React key. */
  field: string;
  /** Nhãn tiếng Việt; trường lạ (backend thêm mới) giữ nguyên khoá thô. */
  label: string;
  /** true = không có nhãn -> hiện khoá thô dạng chữ đơn cách. */
  labelKnown: boolean;
  old: ChangeValue;
  new: ChangeValue;
}

/** Giá trị đã định dạng: `empty` = null/rỗng ("(trống)"), `block` = nhiều
 *  dòng/JSON, hiện trong khung cuộn. */
export type ChangeValue = { empty: true } | { empty: false; text: string; block: boolean };

export interface ChangeContext {
  /** ss_user_id -> họ tên, để đổi `assigned_ss_user` từ UUID sang tên. */
  staffNames: Record<string, string>;
  /** action_type của log. Chỉ MERGE_JOB cần (đọc các khoá đặc biệt của gộp job);
   *  bỏ trống = coi mọi khoá là cột job/công ty/... như trước. */
  actionType?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(field: string, value: unknown, ctx: ChangeContext): ChangeValue {
  if (value === null || value === undefined) return { empty: true };

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return { empty: true };
    if (field === "assigned_ss_user") {
      // Không hiện UUID thô; tài khoản không còn trong danh sách staff -> nói rõ.
      return { empty: false, text: ctx.staffNames[value] ?? "(tài khoản không xác định)", block: false };
    }
    if (DATE_FIELDS.has(field)) return { empty: false, text: formatDateVN(value), block: false };
    // Log cũ lưu số của cột NUMERIC dạng chuỗi ("10000000.00", do
    // json.dumps(default=str) ở backend) — đổi về số để định dạng giống giá
    // trị mới, không thì "cũ -> mới" hiện 2 kiểu số khác nhau.
    if (NUMBER_FIELDS.has(field) && /^-?\d+(\.\d+)?$/.test(text)) {
      return { empty: false, text: new Intl.NumberFormat("vi-VN").format(Number(text)), block: false };
    }
    const label = VALUE_LABELS[field]?.[value];
    if (label) return { empty: false, text: label, block: false };
    return { empty: false, text: value, block: value.includes("\n") || value.length > 80 };
  }
  if (typeof value === "number") {
    const text = NUMBER_FIELDS.has(field) ? new Intl.NumberFormat("vi-VN").format(value) : String(value);
    return { empty: false, text, block: false };
  }
  if (typeof value === "boolean") return { empty: false, text: value ? "Có" : "Không", block: false };
  if (Array.isArray(value)) {
    if (value.length === 0) return { empty: true };
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return { empty: false, text: value.join(", "), block: false };
    }
  }
  // Object / mảng lẫn kiểu: in JSON thô thay vì đoán cấu trúc.
  return { empty: false, text: JSON.stringify(value, null, 2), block: true };
}

/** parsed_content là object lồng nhau (mô tả, yêu cầu, quyền lợi, kỹ năng) —
 *  tách thành từng trường con và CHỈ giữ trường con thật sự khác nhau, thay
 *  vì đổ nguyên khối JSON. */
function expandParsedContent(oldV: unknown, newV: unknown): { field: string; old: unknown; new: unknown }[] | null {
  const oldOk = oldV == null || isRecord(oldV);
  const newOk = newV == null || isRecord(newV);
  if (!oldOk || !newOk) return null;
  const o = (oldV ?? {}) as Record<string, unknown>;
  const n = (newV ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
  return keys
    .filter((k) => JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null))
    .map((k) => ({ field: `parsed_content.${k}`, old: o[k], new: n[k] }));
}

/** Danh sách dòng thay đổi để hiển thị; [] nếu log không có `changes`. */
export function parseChanges(
  entityType: string,
  changes: Record<string, unknown> | null | undefined,
  ctx: ChangeContext,
): ChangeRow[] {
  if (!isRecord(changes)) return [];
  const labels = FIELD_LABELS[entityType] ?? {};
  const raw: { field: string; old: unknown; new: unknown }[] = [];
  const isMerge = ctx.actionType === "MERGE_JOB";

  for (const [field, entry] of Object.entries(changes)) {
    // Khoá riêng của gộp job: không phải {old,new} nên không đi đường diff.
    if (isMerge && MERGE_INFO_KEYS.has(field)) continue;
    // Đúng dạng backend: {old, new}. Dạng khác -> coi cả entry là giá trị mới.
    const pair = isRecord(entry) && ("old" in entry || "new" in entry) ? entry : { old: undefined, new: entry };
    if (field === "parsed_content") {
      const expanded = expandParsedContent(pair.old, pair.new);
      if (expanded) {
        raw.push(...expanded);
        continue;
      }
    }
    raw.push({ field, old: pair.old, new: pair.new });
  }

  const diffRows: ChangeRow[] = raw.map((r) => {
    const label = labels[r.field];
    return {
      kind: "diff",
      field: r.field,
      label: label ?? r.field,
      labelKnown: label !== undefined,
      old: formatValue(r.field, r.old, ctx),
      new: formatValue(r.field, r.new, ctx),
    };
  });
  return isMerge ? [...diffRows, ...buildMergeRows(changes)] : diffRows;
}
