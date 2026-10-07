// lib/audit-merge.ts
// Hiển thị gọn phần `changes` của log MERGE_JOB (gộp job trùng bằng CLI
// `main.py merge-duplicates --apply`, backend db/job_merge.py::merge_job_group).
// Hàm THUẦN (không React, không gọi API). Nhóm 0.
//
// Backend ghi 2 loại log MERGE_JOB cho mỗi nhóm gộp:
//  - Log của JOB PHỤ (job bị xoá thật):
//      changes = { merged_into: <job_id job giữ>, snapshot: {...} }
//    snapshot = { job: <nguyên dòng job_postings>,
//                 job_sources_log | saved_jobs | job_applications:
//                   { moved: [id...], dropped: [<dòng bị bỏ>...] },
//                 job_contact_links: { moved: [id...], merged: [{link,
//                   merged_into_link_id, interactions_moved: [id...]}] } }
//  - Log của JOB GIỮ (chỉ có khi có trường đổi hoặc có xung đột):
//      changes = { <cột>: {old, new}..., merged_from: [job_id phụ...],
//                  conflicts?, link_status_conflicts?, notes? }
//
// Đổ nguyên khối JSON snapshot (cả mô tả JD, nội dung crawl) vào bảng là
// không đọc được, nên ở đây tóm tắt: job phụ là gì, dữ liệu con đã chuyển/bỏ
// bao nhiêu. Bản chụp đầy đủ vẫn nằm trong DB (audit_logs.changes.snapshot).
//
// Mọi đầu vào được coi là JSON bất kỳ: kiểu lạ thì lùi về JSON thô, không để
// trang vỡ (giống lib/audit-changes.ts).

import { JOB_STATUS_LABELS } from "@/lib/constants";
import { formatDateVN } from "@/lib/date";
import type { ChangeRow, ChangeValue } from "@/lib/audit-changes";

/** Các khoá `changes` của MERGE_JOB không phải cột job_postings — parseChanges
 *  bỏ chúng khỏi luồng "cũ -> mới" và để buildMergeRows xử lý. */
export const MERGE_INFO_KEYS: ReadonlySet<string> = new Set([
  "merged_into",
  "snapshot",
  "merged_from",
  "conflicts",
  "link_status_conflicts",
  "notes",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 8 ký tự đầu của UUID — đủ để đối chiếu với nhãn "Gộp job trùng vào xxxxxxxx"
 *  trong note do backend ghi. */
function shortId(v: unknown): string {
  return typeof v === "string" && v ? v.slice(0, 8) : "?";
}

function info(text: string, block = false): ChangeValue {
  return text.trim() ? { empty: false, text, block } : { empty: true };
}

function infoRow(field: string, label: string, value: ChangeValue): ChangeRow {
  return { kind: "info", field, label, labelKnown: true, old: { empty: true }, new: value };
}

function rawJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Số trong object con của snapshot: {moved: [...], dropped|merged: [...]}. */
function pair(group: unknown, secondKey: "dropped" | "merged"): { moved: unknown[]; second: unknown[] } {
  const g = isRecord(group) ? group : {};
  return { moved: asArray(g.moved), second: asArray(g[secondKey]) };
}

/** Mô tả job phụ từ snapshot.job (dòng job_postings nguyên bản). */
function describeDonorJob(job: unknown): string {
  if (!isRecord(job)) return "";
  const lines: string[] = [];
  if (typeof job.job_title === "string" && job.job_title.trim()) lines.push(`Tiêu đề: ${job.job_title.trim()}`);
  if (typeof job.job_status === "string") {
    lines.push(`Trạng thái: ${JOB_STATUS_LABELS[job.job_status] ?? job.job_status}`);
  }
  if (typeof job.deadline === "string" && job.deadline) lines.push(`Hạn nộp: ${formatDateVN(job.deadline)}`);
  if (typeof job.source_url === "string" && job.source_url) lines.push(`Link tin: ${job.source_url}`);
  return lines.join("\n");
}

/** Tóm tắt dữ liệu con đã chuyển sang job giữ / bỏ vì trùng khoá. Chỉ liệt kê
 *  bảng có dữ liệu để dòng không dài vô ích. */
function describeChildren(snapshot: Record<string, unknown>): string {
  const lines: string[] = [];

  const logs = pair(snapshot.job_sources_log, "dropped");
  if (logs.moved.length || logs.second.length) {
    lines.push(`Nguồn tin (job_sources_log): chuyển ${logs.moved.length}, bỏ ${logs.second.length}`);
  }

  const saved = pair(snapshot.saved_jobs, "dropped");
  if (saved.moved.length || saved.second.length) {
    lines.push(`JD đã lưu: chuyển ${saved.moved.length}, bỏ ${saved.second.length}`);
  }

  const apps = pair(snapshot.job_applications, "dropped");
  if (apps.moved.length || apps.second.length) {
    // CV của đơn bị bỏ là dữ liệu khó khôi phục nhất -> nêu riêng số đơn có CV.
    const withCv = apps.second.filter((a) => isRecord(a) && a.cv_url).length;
    lines.push(
      `Đơn ứng tuyển: chuyển ${apps.moved.length}, bỏ ${apps.second.length}` +
        (withCv > 0 ? ` (trong đó ${withCv} đơn có CV)` : ""),
    );
  }

  const links = pair(snapshot.job_contact_links, "merged");
  if (links.moved.length || links.second.length) {
    const interactions = links.second.reduce<number>(
      (sum, m) => sum + (isRecord(m) ? asArray(m.interactions_moved).length : 0),
      0,
    );
    lines.push(
      `Liên kết người liên hệ: chuyển ${links.moved.length}, dồn vào liên kết có sẵn ${links.second.length}` +
        (interactions > 0 ? ` (chuyển ${interactions} lượt trao đổi)` : ""),
    );
  }

  return lines.join("\n");
}

function formatSalaryView(v: unknown): string {
  if (!isRecord(v)) return String(v ?? "(trống)");
  const fmt = (n: unknown) =>
    n === null || n === undefined || n === "" ? null : new Intl.NumberFormat("vi-VN").format(Number(n));
  const min = fmt(v.salary_min);
  const max = fmt(v.salary_max);
  const range = min && max ? `${min} – ${max}` : (min ?? max ?? "(không có số)");
  return `${range}${typeof v.currency === "string" && v.currency ? ` ${v.currency}` : ""}`;
}

const CONFLICT_FIELD_LABELS: Record<string, string> = {
  salary: "Lương",
  level: "Cấp bậc",
  ss_team_notes: "Ghi chú nội bộ",
};

function formatConflictValue(field: unknown, v: unknown): string {
  if (field === "salary") return formatSalaryView(v);
  if (v === null || v === undefined || v === "") return "(trống)";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  return rawJson(v);
}

/** Bản lệch bị bỏ lại: "Lương: giữ A (job x), bỏ B (job y)". */
function describeConflicts(conflicts: unknown): string {
  return asArray(conflicts)
    .map((c) => {
      if (!isRecord(c)) return rawJson(c);
      const label = CONFLICT_FIELD_LABELS[String(c.field)] ?? String(c.field ?? "?");
      return (
        `${label}: giữ ${formatConflictValue(c.field, c.kept)} (job ${shortId(c.kept_job_id)}), ` +
        `bỏ ${formatConflictValue(c.field, c.other)} (job ${shortId(c.other_job_id)})`
      );
    })
    .join("\n");
}

/** Hai liên kết cùng người liên hệ có trạng thái trao đổi khác nhau. */
function describeLinkStatusConflicts(conflicts: unknown): string {
  return asArray(conflicts)
    .map((c) => {
      if (!isRecord(c)) return rawJson(c);
      return `Người liên hệ ${shortId(c.contact_id)}: giữ trạng thái "${c.kept ?? ""}", bỏ "${c.other ?? ""}"`;
    })
    .join("\n");
}

/**
 * Các dòng "thông tin" (kind = "info") cho log MERGE_JOB, từ các khoá trong
 * MERGE_INFO_KEYS. Thứ tự cố định (JSONB không giữ thứ tự khoá). Không có khoá
 * nào -> [].
 */
export function buildMergeRows(changes: Record<string, unknown>): ChangeRow[] {
  const rows: ChangeRow[] = [];

  if ("merged_into" in changes) {
    const v = changes.merged_into;
    rows.push(
      infoRow(
        "merged_into",
        "Đã gộp vào job",
        typeof v === "string" && v ? info(shortId(v)) : info(rawJson(v), true),
      ),
    );
  }

  if ("snapshot" in changes) {
    const snap = changes.snapshot;
    if (isRecord(snap)) {
      rows.push(infoRow("snapshot.job", "Job phụ (đã xoá)", info(describeDonorJob(snap.job), true)));
      const children = describeChildren(snap);
      rows.push(
        infoRow(
          "snapshot.children",
          "Dữ liệu con đã xử lý",
          children ? info(children, true) : info("Không có dữ liệu con"),
        ),
      );
    } else {
      rows.push(infoRow("snapshot", "Bản chụp job phụ", info(rawJson(snap), true)));
    }
  }

  if ("merged_from" in changes) {
    const ids = asArray(changes.merged_from);
    rows.push(
      infoRow(
        "merged_from",
        "Đã nhận các job trùng",
        ids.length ? info(`${ids.length} job: ${ids.map(shortId).join(", ")}`) : { empty: true },
      ),
    );
  }

  if ("notes" in changes) {
    const lines = asArray(changes.notes).map((n) => (typeof n === "string" ? n : rawJson(n)));
    if (lines.length) rows.push(infoRow("notes", "Lý do thay đổi", info(lines.join("\n"), true)));
  }

  if ("conflicts" in changes) {
    const text = describeConflicts(changes.conflicts);
    if (text) rows.push(infoRow("conflicts", "Bản lệch bị bỏ lại", info(text, true)));
  }

  if ("link_status_conflicts" in changes) {
    const text = describeLinkStatusConflicts(changes.link_status_conflicts);
    if (text) rows.push(infoRow("link_status_conflicts", "Trạng thái liên hệ lệch nhau", info(text, true)));
  }

  return rows;
}

/**
 * job_id của job giữ nếu đây là log của JOB PHỤ (job đã bị xoá), ngược lại null.
 * Dựa vào khoá `merged_into` của changes chứ không dựa vào entity_id: log của
 * job giữ cùng action MERGE_JOB nhưng job đó còn tồn tại và vẫn link được.
 */
export function mergedIntoJobId(
  actionType: string,
  changes: Record<string, unknown> | null | undefined,
): string | null {
  if (actionType !== "MERGE_JOB" || !isRecord(changes)) return null;
  const v = changes.merged_into;
  return typeof v === "string" && v ? v : null;
}
