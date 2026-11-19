"use client";
// app/(app)/data-management/import-review-view.tsx
// Khung xem lại preview: bảng dòng (phân trang), quyết định từng dòng, ghi chú, xác nhận.
//
// "Dòng N" = số dòng trong file gốc, tính cả dòng tiêu đề (row_index + 2), khớp message backend.
// Mặc định chỉ hiện dòng cần xử lý nếu có; dòng vừa xử lý xong vẫn ở lại danh sách trong lượt này
// (touched) để không biến mất khỏi tay staff. Nút xác nhận chỉ tắt khi ĐANG gửi, không tắt sớm ở nhánh
// báo lỗi (thiếu ghi chú, còn dòng chưa xử lý) để staff đọc thông báo rồi bấm lại được.

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { Button } from "@/components/ui/button";
import type { DataEntityType } from "@/lib/data-ops/export-filters";
import type { ImportPreviewRow } from "@/lib/data-ops/import";
import { fetchImportPreview, resolveCompany, verifyField } from "@/lib/data-ops/import-client";
import {
  confirmProblem,
  effectiveAction,
  pairOf,
  reviewStats,
  rowBlockers,
  rowIndexMap,
  type FlowAction,
  type ReviewState,
} from "@/lib/data-ops/import-review";
import {
  IMPORT_BLOCKER_LABELS,
  IMPORT_PREVIEW_COLUMNS,
  IMPORT_ROWS_PER_PAGE,
  IMPORT_STATUS_LABELS,
  formatImportCell,
  pageCount,
  pairChoiceLabels,
} from "@/lib/data-ops/import-ui";
import { ImportClientError } from "@/lib/data-ops/import-client";
import { ImportCompanyDialog } from "./import-company-dialog";
import { ActionSelect, FixCellInput, LevelSelect } from "./import-row-controls";

export function ImportReviewView({
  entity,
  review,
  confirming,
  error,
  levelCodes,
  dispatch,
  onConfirm,
  onCancel,
  onGone,
}: {
  entity: DataEntityType;
  review: ReviewState;
  confirming: boolean;
  error: string | null;
  levelCodes: string[];
  dispatch: Dispatch<FlowAction>;
  onConfirm: () => void;
  onCancel: () => void;
  /** Preview hết hạn/không còn trong lúc thao tác. */
  onGone: (message: string) => void;
}) {
  const { preview, edits } = review;
  const byIndex = useMemo(() => rowIndexMap(preview.rows), [preview.rows]);
  const stats = useMemo(() => reviewStats(review), [review]);
  const [onlyAttention, setOnlyAttention] = useState(true);
  const [page, setPage] = useState(0);
  const [touched, setTouched] = useState<ReadonlySet<number>>(new Set());
  const [companyRow, setCompanyRow] = useState<ImportPreviewRow | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const focusRow = useRef<number | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const touch = (i: number) => setTouched((s) => (s.has(i) ? s : new Set(s).add(i)));

  const visible = useMemo(
    () =>
      onlyAttention
        ? preview.rows.filter((r) => r.needs_resolution || touched.has(r.row_index))
        : preview.rows,
    [onlyAttention, preview.rows, touched],
  );
  const pages = pageCount(visible.length);
  const safePage = Math.min(page, pages - 1);
  const pageRows = visible.slice(safePage * IMPORT_ROWS_PER_PAGE, (safePage + 1) * IMPORT_ROWS_PER_PAGE);

  // Cuộn tới dòng cần chú ý sau khi trang/bộ lọc đã dựng xong.
  useEffect(() => {
    if (focusRow.current === null) return;
    document.getElementById(`import-row-${focusRow.current}`)?.scrollIntoView({ block: "center" });
    focusRow.current = null;
  }, [focusTick, pageRows]);

  async function handleGone(err: unknown): Promise<string> {
    if (err instanceof ImportClientError && err.previewGone) {
      onGone(err.message);
      return err.message;
    }
    return err instanceof Error ? err.message : "Không thực hiện được yêu cầu.";
  }

  // Contact: sửa một ô / chọn công ty có thể đổi ngầm dòng KHÁC -> tải lại cả preview thay vì patch một dòng.
  async function syncRow(row: ImportPreviewRow) {
    if (entity === "contact") {
      dispatch({ type: "preview_replaced", preview: await fetchImportPreview(entity, preview.preview_id) });
    } else {
      dispatch({ type: "row_replaced", row });
    }
  }

  async function verify(row: ImportPreviewRow, field: string, value: string): Promise<string | null> {
    try {
      const out = await verifyField(entity, preview.preview_id, row.row_index, field, value);
      if (out.fieldError) return out.fieldError.message;
      await syncRow(out.row);
      dispatch({ type: "fix_verified", rowIndex: row.row_index, field, value });
      touch(row.row_index);
      return null;
    } catch (err) {
      return handleGone(err);
    }
  }

  async function chooseCompany(row: ImportPreviewRow, companyId: string | null) {
    try {
      const updated = await resolveCompany(entity, preview.preview_id, row.row_index, companyId);
      await syncRow(updated);
      touch(row.row_index);
    } catch (err) {
      throw new Error(await handleGone(err));
    }
  }

  function tryConfirm() {
    const problem = confirmProblem(review);
    setLocalError(problem?.message ?? null);
    if (!problem) return onConfirm();
    if (problem.firstBlockedRow !== undefined) {
      const idx = problem.firstBlockedRow;
      const row = byIndex.get(idx);
      if (row && onlyAttention && !(row.needs_resolution || touched.has(idx))) setOnlyAttention(false);
      const list = onlyAttention && row && (row.needs_resolution || touched.has(idx)) ? visible : preview.rows;
      const pos = list.findIndex((r) => r.row_index === idx);
      if (pos >= 0) setPage(Math.floor(pos / IMPORT_ROWS_PER_PAGE));
      focusRow.current = idx;
      setFocusTick((t) => t + 1);
    } else {
      document.getElementById("import-note")?.focus();
    }
  }

  const cols = IMPORT_PREVIEW_COLUMNS[entity];
  const s = preview.summary;

  return (
    <section className="space-y-4" aria-label="Xem lại dữ liệu trước khi nhập">
      <div className="flex flex-wrap gap-2 text-sm" data-testid="import-summary">
        <Chip label="Tổng dòng" value={s.total_rows} />
        <Chip label="Mới" value={s.new_records} />
        <Chip label="Trùng" value={s.conflicts + s.conflicts_inactive} />
        <Chip label="Chưa chọn công ty" value={s.pending_company_resolution} />
        <Chip label="Trùng trong file" value={s.conflicts_in_batch} />
        <Chip label="Cần chọn level" value={s.pending_level_resolution} />
        <Chip label="Có ô lỗi" value={s.pending_field_fix} />
      </div>

      <p className="text-sm" data-testid="import-plan">
        Dự kiến: tạo mới <strong>{stats.willCreate}</strong>, cập nhật <strong>{stats.willUpdate}</strong>, bỏ
        qua <strong>{stats.willSkip}</strong>
        {stats.undecided > 0 && <>, chưa quyết định <strong>{stats.undecided}</strong></>}. Còn{" "}
        <strong data-testid="import-blocked">{stats.blockedRows}</strong> dòng chưa xử lý xong.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyAttention}
          onChange={(e) => {
            setOnlyAttention(e.target.checked);
            setPage(0);
          }}
        />
        Chỉ hiện dòng cần xử lý ({stats.needsResolution})
      </label>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Dòng</th>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 3} className="px-3 py-6 text-center text-muted-foreground">
                  Không có dòng nào cần xử lý.
                </td>
              </tr>
            )}
            {pageRows.map((row) => {
              const edit = edits[row.row_index];
              const blockers = rowBlockers(row, byIndex, edits);
              const pair = pairOf(row, byIndex);
              const eff = effectiveAction(row, byIndex, edits);
              return (
                <tr
                  key={row.row_index}
                  id={`import-row-${row.row_index}`}
                  data-testid={`import-row-${row.row_index}`}
                  className="border-t align-top"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{row.row_index + 2}</td>
                  {cols.map((c) => (
                    <td key={c} className="max-w-xs truncate px-3 py-2" title={formatImportCell(row.data[c])}>
                      {formatImportCell(row.data[c])}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {IMPORT_STATUS_LABELS[row.conflict_status]}
                    </span>
                    {row.duplicate_match && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Khớp {Math.round(row.duplicate_match.match_score * 100)}%:{" "}
                        {row.duplicate_match.matched_fields.join(", ")}
                      </span>
                    )}
                    {blockers.length === 0 && row.needs_resolution && (
                      <span className="mt-1 block text-xs text-emerald-600">Đã xử lý</span>
                    )}
                    {blockers.map((b) => (
                      <span key={b} className="mt-1 block text-xs text-amber-600" data-testid={`blocker-${b}`}>
                        {IMPORT_BLOCKER_LABELS[b]}
                      </span>
                    ))}
                  </td>
                  <td className="min-w-64 space-y-2 px-3 py-2">
                    {row.conflict_status === "no_conflict" && !row.needs_resolution && (
                      <span className="text-xs text-muted-foreground">Tạo mới</span>
                    )}
                    {row.conflict_status === "pending_company_resolution" && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setCompanyRow(row)}>
                        Chọn công ty…
                      </Button>
                    )}
                    {pair ? (
                      <PairChoice
                        loRow={pair.lo + 2}
                        hiRow={pair.hi + 2}
                        isLo={row.row_index === pair.lo}
                        decision={edits[pair.lo]?.action ?? null}
                        effective={eff}
                        otherPercent={row.duplicate_in_batch?.match_score}
                        onChoose={(action) => {
                          dispatch({ type: "set_action", rowIndex: pair.lo, action });
                          touch(row.row_index);
                        }}
                      />
                    ) : (
                      <ActionSelect
                        row={row}
                        value={edit?.action ?? null}
                        onChange={(action) => {
                          dispatch({ type: "set_action", rowIndex: row.row_index, action });
                          touch(row.row_index);
                        }}
                      />
                    )}
                    {eff === "update" && row.conflict_status === "conflict_inactive" && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={edit?.confirmReactivate ?? false}
                          onChange={(e) =>
                            dispatch({ type: "set_reactivate", rowIndex: row.row_index, value: e.target.checked })
                          }
                        />
                        Tôi xác nhận kích hoạt lại bản ghi đã ngừng hoạt động
                      </label>
                    )}
                    {row.needs_level_resolve && eff !== "skip" && (
                      <LevelSelect
                        value={edit?.levelCode ?? ""}
                        levels={levelCodes}
                        rawLevel={rawLevelOf(row)}
                        onChange={(levelCode) => {
                          dispatch({ type: "set_level", rowIndex: row.row_index, levelCode });
                          touch(row.row_index);
                        }}
                      />
                    )}
                    {eff !== "skip" &&
                      Object.entries(edit?.fixes ?? {}).map(([field, cell]) => (
                        <FixCellInput
                          key={field}
                          field={field}
                          cell={cell}
                          backendMessage={row.field_errors[field]?.message}
                          onEdited={(value) => dispatch({ type: "fix_edited", rowIndex: row.row_index, field, value })}
                          onVerify={(value) => verify(row, field, value)}
                        />
                      ))}
                    <RowDetails row={row} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Trước
          </Button>
          <span>
            Trang {safePage + 1}/{pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      <div className="space-y-2 rounded-md border p-4">
        <label className="block text-sm">
          <span className="font-medium">
            Ghi chú cho lượt nhập <span className="text-destructive">*</span>
          </span>
          <textarea
            id="import-note"
            value={review.note}
            onChange={(e) => dispatch({ type: "set_note", note: e.target.value })}
            rows={2}
            placeholder="Ví dụ: nhập danh sách job tuần 46 từ file của team"
            className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        {(localError || error) && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="import-error">
            {localError ?? error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={tryConfirm} disabled={confirming} data-testid="import-confirm">
            {confirming ? "Đang nhập…" : "Xác nhận nhập dữ liệu"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
            Hủy, tải file khác
          </Button>
        </div>
      </div>

      {companyRow && (
        <ImportCompanyDialog
          open
          onOpenChange={(o) => !o && setCompanyRow(null)}
          entity={entity}
          previewId={preview.preview_id}
          row={companyRow}
          onChoose={(id) => chooseCompany(companyRow, id)}
        />
      )}
    </section>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border px-2 py-1">
      {label}: <strong>{value}</strong>
    </span>
  );
}

function rawLevelOf(row: ImportPreviewRow): string | undefined {
  const raw = (row as unknown as { level_code_raw?: unknown }).level_code_raw;
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}

function RowDetails({ row }: { row: ImportPreviewRow }) {
  const existing = row.existing_record;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">Xem tất cả cột</summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {Object.entries(row.data).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-all">{formatImportCell(v)}</dd>
          </div>
        ))}
      </dl>
      {existing && (
        <>
          <p className="mt-2 font-medium">Bản ghi đã có trong hệ thống</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {Object.entries(existing).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all">{formatImportCell(v)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </details>
  );
}

function PairChoice({
  loRow,
  hiRow,
  isLo,
  decision,
  effective,
  otherPercent,
  onChoose,
}: {
  loRow: number;
  hiRow: number;
  isLo: boolean;
  decision: string | null;
  effective: "skip" | "create" | "update" | null;
  otherPercent?: number;
  onChoose: (action: "keep_this" | "keep_other" | "import_both") => void;
}) {
  const other = isLo ? hiRow : loRow;
  return (
    <div className="space-y-1" data-testid="pair-choice">
      <p className="text-xs text-muted-foreground">
        Trùng với dòng {other}
        {otherPercent !== undefined ? ` (khớp ${Math.round(otherPercent * 100)}%)` : ""}. Một lựa chọn áp dụng
        cho cả hai dòng.
      </p>
      <div className="flex flex-wrap gap-1">
        {pairChoiceLabels(loRow, hiRow).map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChoose(c.value)}
            aria-pressed={decision === c.value}
            className={`rounded-md border px-2 py-1 text-xs ${decision === c.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {effective && (
        <p className="text-xs">Dòng này sẽ: {effective === "skip" ? "bị bỏ qua" : "được tạo mới"}</p>
      )}
    </div>
  );
}
