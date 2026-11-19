// lib/data-ops/import-review.ts
// Máy trạng thái THUẦN của tab Nhập dữ liệu (Nhóm 6, phần 2/3): xem lại preview, quyết định từng
// dòng, sửa ô lỗi, dựng payload confirm. Không mạng, không React -> reducer/hàm dùng chung cho
// Client Component và test.
//
// Nguyên tắc (đều từ bug thật của bản Flask, xem docs/Plan_NextJS.md mục data_management):
//  - Một dòng mang NHIỀU trục độc lập (conflict_status, needs_level_resolve, needs_field_fix);
//    "việc còn phải làm" của dòng là tập hợp các blocker, không phải một trạng thái duy nhất.
//  - Ô lỗi chỉ coi là XONG khi backend re-validate thành công (verify-field trả field_error = null).
//    Sửa lại ô đã xong thì gỡ đúng ô đó về "chưa xác nhận".
//  - Dòng conflict_in_batch (Contact) và pending_company_resolution KHÔNG có mặc định: staff phải chọn.
//    Cả cặp conflict_in_batch chỉ cần MỘT quyết định, gửi đúng một action lan truyền.
//  - Dòng no_conflict luôn được backend TẠO MỚI bất kể action (import_executor kiểm status trước):
//    nên UI không cho "Bỏ qua" dòng no_conflict, và effectiveAction luôn là "create".
//  - Payload confirm: khoá resolutions là row_index dạng string; schema extra="forbid" nên chỉ đặt
//    field thật sự áp dụng cho action đang gửi.

import {
  IMPORT_NEW_COMPANY_ID,
  isBatchPropagatingAction,
  resolutionKey,
  type ImportConfirmResult,
  type ImportFieldWidgetType,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportResolutionAction,
  type ImportResolutions,
  type ImportRowError,
  type ImportRowResolution,
} from "./import";

// ---------------------------------------------------------------------------
// Kiểu
// ---------------------------------------------------------------------------

/** null = staff CHƯA quyết định (chỉ hợp lệ với pending_company_resolution và conflict_in_batch). */
export type RowDecision = ImportResolutionAction | null;

export interface FixCell {
  /** Giá trị đang hiển thị trong ô (chuỗi thô). */
  value: string;
  /** true chỉ sau khi backend re-validate thành công đúng giá trị này. */
  verified: boolean;
  /** Loại ô nhập do BACKEND chỉ định (không đoán theo tên field); giữ lại để sửa lại được sau khi đã verify. */
  widget: ImportFieldWidgetType;
  options: string[] | null;
}

export interface RowEdit {
  /** Với dòng đầu cặp conflict_in_batch: quyết định CỦA CẢ CẶP (keep_this/keep_other/import_both). */
  action: RowDecision;
  /** Staff xác nhận kích hoạt lại bản ghi ngừng hoạt động (chỉ dòng conflict_inactive + update). */
  confirmReactivate: boolean;
  /** Level staff chọn lại cho dòng needs_level_resolve ("" = chưa chọn). */
  levelCode: string;
  /** field_name -> ô sửa tại chỗ. */
  fixes: Record<string, FixCell>;
}

export interface ReviewState {
  preview: ImportPreview;
  edits: Record<number, RowEdit>;
  /** Ghi chú bắt buộc của lượt nhập (chưa trim). */
  note: string;
}

export type RowBlocker = "action" | "level" | "fix" | "reactivate";

// ---------------------------------------------------------------------------
// Mặc định và tra cứu
// ---------------------------------------------------------------------------

/**
 * Action mặc định theo conflict_status:
 *  - no_conflict: create ngầm (UI ẩn cột hành động);
 *  - conflict / conflict_inactive: skip (an toàn, staff phải tự đổi nếu muốn ghi đè);
 *  - pending_company_resolution / conflict_in_batch: null — bắt buộc chọn (không âm thầm bỏ hay tạo).
 */
export function defaultActionFor(row: Pick<ImportPreviewRow, "conflict_status">): RowDecision {
  switch (row.conflict_status) {
    case "no_conflict":
      return "create";
    case "conflict":
    case "conflict_inactive":
      return "skip";
    default:
      return null;
  }
}

/** Ô sửa cho các field còn lỗi của dòng; giữ ô đã có (kể cả ô đã verify nên không còn trong field_errors). */
function cellsFor(row: ImportPreviewRow, existing: Record<string, FixCell>): Record<string, FixCell> {
  const out: Record<string, FixCell> = { ...existing };
  for (const [field, err] of Object.entries(row.field_errors)) {
    if (!out[field]) {
      out[field] = {
        value: err.raw_value ?? "",
        verified: false,
        widget: err.widget_type,
        options: err.options ?? null,
      };
    }
  }
  return out;
}

export function initialEdit(row: ImportPreviewRow): RowEdit {
  return {
    action: defaultActionFor(row),
    confirmReactivate: false,
    levelCode: "",
    fixes: cellsFor(row, {}),
  };
}

export function rowIndexMap(rows: ImportPreviewRow[]): Map<number, ImportPreviewRow> {
  return new Map(rows.map((r) => [r.row_index, r]));
}

/**
 * Cặp conflict_in_batch hai chiều (A trỏ B và B trỏ lại A). Không hai chiều (3+ dòng trùng nhau) ->
 * null: lúc đó staff phải chọn skip/create riêng cho từng dòng, backend từ chối action lan truyền.
 */
export function pairOf(
  row: ImportPreviewRow,
  byIndex: Map<number, ImportPreviewRow>,
): { lo: number; hi: number } | null {
  if (row.conflict_status !== "conflict_in_batch") return null;
  const otherIndex = row.duplicate_in_batch?.other_row_index;
  if (typeof otherIndex !== "number") return null;
  const other = byIndex.get(otherIndex);
  if (!other || other.conflict_status !== "conflict_in_batch") return null;
  if (other.duplicate_in_batch?.other_row_index !== row.row_index) return null;
  return { lo: Math.min(row.row_index, otherIndex), hi: Math.max(row.row_index, otherIndex) };
}

function editOf(edits: Record<number, RowEdit>, row: ImportPreviewRow): RowEdit {
  return edits[row.row_index] ?? initialEdit(row);
}

/**
 * Hiệu lực THẬT của quyết định lên chính dòng này (skip / create / update), hoặc null nếu chưa quyết.
 * Dòng no_conflict luôn "create" (backend bỏ qua action cho status này). Dòng trong cặp lấy hiệu lực
 * từ quyết định của cả cặp (lưu ở dòng đầu cặp), khớp BATCH_PROPAGATING_ACTIONS của backend.
 */
export function effectiveAction(
  row: ImportPreviewRow,
  byIndex: Map<number, ImportPreviewRow>,
  edits: Record<number, RowEdit>,
): "skip" | "create" | "update" | null {
  if (row.conflict_status === "no_conflict") return "create";

  const pair = pairOf(row, byIndex);
  if (pair) {
    const decision = edits[pair.lo]?.action ?? null;
    if (decision === null || !isBatchPropagatingAction(decision)) return null;
    const isLo = row.row_index === pair.lo;
    if (decision === "import_both") return "create";
    if (decision === "keep_this") return isLo ? "create" : "skip";
    return isLo ? "skip" : "create"; // keep_other
  }

  const action = editOf(edits, row).action;
  if (action === null) return null;
  // Dòng conflict_in_batch không hai chiều: chỉ skip/create thuần; update không hợp lệ (không có
  // existing_record), action lan truyền không dùng được -> coi như chưa quyết.
  if (row.conflict_status === "conflict_in_batch") {
    return action === "skip" || action === "create" ? action : null;
  }
  // pending_company_resolution: chỉ skip hợp lệ trước khi chọn công ty. create/update chỉ đến sau
  // resolve-company (khi đó status đã đổi).
  if (row.conflict_status === "pending_company_resolution") {
    return action === "skip" ? "skip" : null;
  }
  return action === "skip" || action === "create" || action === "update" ? action : null;
}

/** Danh sách việc còn chặn dòng này (rỗng = dòng sẵn sàng). Dòng sẽ bị bỏ qua thì không có việc gì. */
export function rowBlockers(
  row: ImportPreviewRow,
  byIndex: Map<number, ImportPreviewRow>,
  edits: Record<number, RowEdit>,
): RowBlocker[] {
  const action = effectiveAction(row, byIndex, edits);
  if (action === null) return ["action"];
  if (action === "skip") return [];

  const edit = editOf(edits, row);
  const blockers: RowBlocker[] = [];
  if (row.needs_level_resolve && !edit.levelCode) blockers.push("level");

  const stillFailing = Object.keys(row.field_errors).length > 0;
  const unverified = Object.values(edit.fixes).some((c) => !c.verified);
  if (stillFailing || unverified) blockers.push("fix");

  if (action === "update" && row.conflict_status === "conflict_inactive" && !edit.confirmReactivate) {
    blockers.push("reactivate");
  }
  return blockers;
}

// ---------------------------------------------------------------------------
// Thống kê, kiểm tra trước khi confirm
// ---------------------------------------------------------------------------

export interface ReviewStats {
  total: number;
  /** Dòng còn ít nhất một blocker. */
  blockedRows: number;
  /** Dòng backend đánh dấu cần xử lý (needs_resolution). */
  needsResolution: number;
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  /** Dòng chưa quyết định (effectiveAction = null). */
  undecided: number;
}

export function reviewStats(review: ReviewState): ReviewStats {
  const { rows } = review.preview;
  const byIndex = rowIndexMap(rows);
  const s: ReviewStats = {
    total: rows.length,
    blockedRows: 0,
    needsResolution: 0,
    willCreate: 0,
    willUpdate: 0,
    willSkip: 0,
    undecided: 0,
  };
  for (const row of rows) {
    if (row.needs_resolution) s.needsResolution += 1;
    if (rowBlockers(row, byIndex, review.edits).length > 0) s.blockedRows += 1;
    const a = effectiveAction(row, byIndex, review.edits);
    if (a === "create") s.willCreate += 1;
    else if (a === "update") s.willUpdate += 1;
    else if (a === "skip") s.willSkip += 1;
    else s.undecided += 1;
  }
  return s;
}

export interface ConfirmProblem {
  message: string;
  /** Dòng đầu tiên còn blocker (để cuộn tới), undefined nếu lỗi là thiếu ghi chú. */
  firstBlockedRow?: number;
}

/**
 * Lý do chưa thể confirm, hoặc null nếu sẵn sàng. Được gọi KHI BẤM nút — nút không tắt sớm để staff
 * vẫn bấm lại được sau khi đọc thông báo (plan: chỉ tắt khi đã validate xong và bắt đầu gửi).
 */
export function confirmProblem(review: ReviewState): ConfirmProblem | null {
  const { rows } = review.preview;
  const byIndex = rowIndexMap(rows);
  let blocked = 0;
  let first: number | undefined;
  for (const row of rows) {
    if (rowBlockers(row, byIndex, review.edits).length === 0) continue;
    blocked += 1;
    if (first === undefined) first = row.row_index;
  }
  if (blocked > 0) {
    return {
      message: `Còn ${blocked} dòng chưa xử lý xong. Dòng đầu tiên: dòng ${(first ?? 0) + 2} trong file (tính cả dòng tiêu đề).`,
      firstBlockedRow: first,
    };
  }
  if (review.note.trim() === "") {
    return { message: "Cần nhập ghi chú trước khi xác nhận nhập dữ liệu." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payload confirm
// ---------------------------------------------------------------------------

/**
 * Dựng `resolutions` cho confirm.
 *  - Dòng không needs_resolution -> lược (backend tự tạo mới). Dòng no_conflict + needs_level_resolve
 *    có needs_resolution = true nên KHÔNG bị lược (backend kiểm level trước cả conflict_status).
 *  - Cặp conflict_in_batch hai chiều -> đúng MỘT entry (dòng đầu cặp) với action lan truyền.
 *  - Field boolean/level chỉ đặt khi áp dụng cho action đang gửi (schema extra="forbid").
 *  - Dòng chưa quyết định (không nên xảy ra sau confirmProblem) -> "skip": an toàn hơn đoán tạo mới.
 *  - Không gửi company_id: dòng pending chưa chọn công ty đã bị chặn ở bước trước; chọn xong thì
 *    backend đã lưu company_resolution trong preview.
 */
export function buildConfirmResolutions(review: ReviewState): ImportResolutions {
  const { rows } = review.preview;
  const byIndex = rowIndexMap(rows);
  const out: ImportResolutions = {};

  for (const row of rows) {
    const edit = editOf(review.edits, row);
    const pair = pairOf(row, byIndex);

    if (pair) {
      if (row.row_index !== pair.lo) continue; // cả cặp chỉ cần một entry
      const decision = review.edits[pair.lo]?.action ?? null;
      const resolution: ImportRowResolution =
        decision !== null && isBatchPropagatingAction(decision)
          ? { action: decision }
          : { action: "skip" };
      const eff = effectiveAction(row, byIndex, review.edits);
      if (eff !== "skip") applyExtras(resolution, row, edit, eff);
      out[resolutionKey(row.row_index)] = resolution;
      continue;
    }

    if (!row.needs_resolution) continue;

    const eff = effectiveAction(row, byIndex, review.edits) ?? "skip";
    const resolution: ImportRowResolution = { action: eff };
    if (eff !== "skip") applyExtras(resolution, row, edit, eff);
    out[resolutionKey(row.row_index)] = resolution;
  }
  return out;
}

function applyExtras(
  resolution: ImportRowResolution,
  row: ImportPreviewRow,
  edit: RowEdit,
  eff: "create" | "update" | null,
): void {
  if (row.needs_level_resolve && edit.levelCode) resolution.level_code = edit.levelCode;
  if (eff === "update" && row.conflict_status === "conflict_inactive" && edit.confirmReactivate) {
    resolution.confirm_reactivate = true;
  }
}

/** company_id gửi resolve-company: null nghĩa "tạo công ty mới" (backend nhận cả "__new__"). */
export function companyChoiceToId(choice: string): string | null {
  return choice === IMPORT_NEW_COMPANY_ID ? null : choice;
}

// ---------------------------------------------------------------------------
// Reducer của cả luồng (upload -> review -> kết quả)
// ---------------------------------------------------------------------------

export interface FlowState {
  stage: "upload" | "review";
  busy: "upload" | "confirm" | null;
  /** Lỗi chung của lượt upload/confirm gần nhất, hiện ngay trong khung đang mở. */
  error: string | null;
  /** Mảng lỗi cấp dòng khi file bị từ chối hoàn toàn (422). */
  rowErrors: ImportRowError[] | null;
  /** Kết quả confirm thành công gần nhất — hiện ở khung upload (ở lại tab Nhập, form trống). */
  result: ImportConfirmResult | null;
  review: ReviewState | null;
}

export const INITIAL_FLOW_STATE: FlowState = {
  stage: "upload",
  busy: null,
  error: null,
  rowErrors: null,
  result: null,
  review: null,
};

export type FlowAction =
  | { type: "upload_started" }
  | { type: "upload_failed"; message: string; rowErrors?: ImportRowError[] | null }
  | { type: "upload_succeeded"; preview: ImportPreview }
  /** Backend trả lại MỘT dòng đã cập nhật (verify-field, resolve-company của Job). */
  | { type: "row_replaced"; row: ImportPreviewRow }
  /** Tải lại cả preview (bắt buộc sau verify-field / resolve-company của Contact). */
  | { type: "preview_replaced"; preview: ImportPreview }
  | { type: "set_action"; rowIndex: number; action: RowDecision }
  | { type: "set_reactivate"; rowIndex: number; value: boolean }
  | { type: "set_level"; rowIndex: number; levelCode: string }
  | { type: "fix_edited"; rowIndex: number; field: string; value: string }
  | { type: "fix_verified"; rowIndex: number; field: string; value: string }
  | { type: "set_note"; note: string }
  | { type: "confirm_started" }
  | { type: "confirm_failed"; message: string }
  | { type: "confirm_succeeded"; result: ImportConfirmResult }
  /** Preview hết hạn / không còn: bỏ preview, về khung upload kèm thông báo. */
  | { type: "preview_lost"; message: string }
  | { type: "dismiss_result" }
  | { type: "cancel_review" };

function withEdit(state: FlowState, rowIndex: number, patch: (e: RowEdit) => RowEdit): FlowState {
  if (!state.review) return state;
  const row = state.review.preview.rows.find((r) => r.row_index === rowIndex);
  if (!row) return state;
  const current = state.review.edits[rowIndex] ?? initialEdit(row);
  return {
    ...state,
    review: { ...state.review, edits: { ...state.review.edits, [rowIndex]: patch(current) } },
  };
}

/** Đổi value/verified của một ô, giữ widget/options; ô chưa có (không nên xảy ra) bị bỏ qua. */
function patchCell(
  fixes: Record<string, FixCell>,
  field: string,
  value: string,
  verified: boolean,
): Record<string, FixCell> {
  const cell = fixes[field];
  return cell ? { ...fixes, [field]: { ...cell, value, verified } } : fixes;
}

/** Ghép edit cũ với dòng mới: status đổi (hoặc liên kết cặp đổi) -> action về mặc định của status mới. */
function reconcileEdit(
  prevRow: ImportPreviewRow | undefined,
  prevEdit: RowEdit | undefined,
  nextRow: ImportPreviewRow,
): RowEdit {
  if (!prevEdit || !prevRow) return initialEdit(nextRow);
  const sameStatus = prevRow.conflict_status === nextRow.conflict_status;
  const sameLink =
    (prevRow.duplicate_in_batch?.other_row_index ?? null) ===
    (nextRow.duplicate_in_batch?.other_row_index ?? null);
  const keep = sameStatus && sameLink;
  return {
    action: keep ? prevEdit.action : defaultActionFor(nextRow),
    confirmReactivate: keep ? prevEdit.confirmReactivate : false,
    levelCode: prevEdit.levelCode,
    fixes: cellsFor(nextRow, prevEdit.fixes),
  };
}

export function importFlowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "upload_started":
      return { ...state, busy: "upload", error: null, rowErrors: null, result: null };

    case "upload_failed":
      return {
        ...state,
        stage: "upload",
        busy: null,
        error: action.message,
        rowErrors: action.rowErrors ?? null,
      };

    case "upload_succeeded": {
      const edits: Record<number, RowEdit> = {};
      for (const row of action.preview.rows) edits[row.row_index] = initialEdit(row);
      return {
        stage: "review",
        busy: null,
        error: null,
        rowErrors: null,
        result: null,
        review: { preview: action.preview, edits, note: "" },
      };
    }

    case "row_replaced": {
      if (!state.review) return state;
      const rows = state.review.preview.rows;
      const idx = rows.findIndex((r) => r.row_index === action.row.row_index);
      if (idx < 0) return state;
      const prevRow = rows[idx];
      const nextRows = rows.slice();
      nextRows[idx] = action.row;
      return {
        ...state,
        review: {
          ...state.review,
          preview: { ...state.review.preview, rows: nextRows },
          edits: {
            ...state.review.edits,
            [action.row.row_index]: reconcileEdit(
              prevRow,
              state.review.edits[action.row.row_index],
              action.row,
            ),
          },
        },
      };
    }

    case "preview_replaced": {
      if (!state.review) return state;
      const prevRows = rowIndexMap(state.review.preview.rows);
      const edits: Record<number, RowEdit> = {};
      for (const row of action.preview.rows) {
        edits[row.row_index] = reconcileEdit(
          prevRows.get(row.row_index),
          state.review.edits[row.row_index],
          row,
        );
      }
      return { ...state, review: { ...state.review, preview: action.preview, edits } };
    }

    case "set_action":
      return withEdit(state, action.rowIndex, (e) => ({
        ...e,
        action: action.action,
        // Rời khỏi "update" thì bỏ xác nhận kích hoạt lại, tránh gửi nhầm khi quay lại.
        confirmReactivate: action.action === "update" ? e.confirmReactivate : false,
      }));

    case "set_reactivate":
      return withEdit(state, action.rowIndex, (e) => ({ ...e, confirmReactivate: action.value }));

    case "set_level":
      return withEdit(state, action.rowIndex, (e) => ({ ...e, levelCode: action.levelCode }));

    case "fix_edited":
      return withEdit(state, action.rowIndex, (e) => ({
        ...e,
        fixes: patchCell(e.fixes, action.field, action.value, false),
      }));

    case "fix_verified":
      return withEdit(state, action.rowIndex, (e) => ({
        ...e,
        fixes: patchCell(e.fixes, action.field, action.value, true),
      }));

    case "set_note":
      return state.review ? { ...state, review: { ...state.review, note: action.note } } : state;

    case "confirm_started":
      return { ...state, busy: "confirm", error: null };

    case "confirm_failed":
      return { ...state, busy: null, error: action.message };

    case "confirm_succeeded":
      // Ở lại tab Nhập, về khung upload trống để nhập file tiếp; kết quả chỉ 3 số.
      return { ...INITIAL_FLOW_STATE, result: action.result };

    case "preview_lost":
      return { ...INITIAL_FLOW_STATE, error: action.message };

    case "dismiss_result":
      return { ...state, result: null };

    case "cancel_review":
      return { ...INITIAL_FLOW_STATE };
  }
}
