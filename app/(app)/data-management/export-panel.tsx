"use client";
// app/(app)/data-management/export-panel.tsx
// Tab "Xuất dữ liệu" (Nhóm 6, phần 1/3). Luồng: chọn bộ lọc -> "Xem trước" -> tải Excel/CSV.
//
// NGUYÊN TẮC "xem gì tải đó": hai nút tải chỉ bật khi có một lượt xem trước THÀNH CÔNG và
// exportFiltersKey(bộ lọc hiện tại) === key của lượt xem trước đó. Sửa bộ lọc sau khi xem trước
// thì nút tải tắt lại cho tới khi xem trước lại. Query tải file sinh bằng cùng
// buildExportDownloadQuery() với server nên file tải về khớp đúng những gì đã xem.
//
// Tải file = điều hướng trình duyệt thường (<a href>) tới /data-management/export/{entity}, backend
// đặt Content-Disposition nên trình duyệt tự lưu file; không dựng blob thủ công.
// Dữ liệu xem trước chỉ render là text thuần (không dangerouslySetInnerHTML).

import { useRef, useState } from "react";
import { CompanyFilterCombobox } from "../activity-logs/company-filter-combobox";
import {
  EXPORT_FILTER_SUPPORT,
  buildExportDownloadQuery,
  exportFiltersKey,
  validateExportFilters,
  type DataEntityType,
  type ExportDateField,
  type ExportFormat,
} from "@/lib/data-ops/export-filters";
import {
  DATA_ENTITY_LABELS,
  EMPTY_EXPORT_FORM,
  exportHttpErrorMessage,
  exportStatusOptions,
  formToExportFilters,
  formatPreviewCell,
  type ExportFormValues,
} from "@/lib/data-ops/export-ui";

interface PreviewData {
  entity_type: string;
  total_matching: number;
  will_export: number;
  columns: string[];
  sample_rows?: Record<string, unknown>[];
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; key: string; data: PreviewData };

const FIELD = "rounded-md border bg-background px-3 py-2 text-sm";

export function ExportPanel({ entity }: { entity: DataEntityType }) {
  const [form, setForm] = useState<ExportFormValues>(EMPTY_EXPORT_FORM);
  const [companyName, setCompanyName] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const support = EXPORT_FILTER_SUPPORT[entity];
  const statusOptions = exportStatusOptions(entity);
  const { filters, error: formError } = formToExportFilters(entity, form);
  const validationError = formError ?? validateExportFilters(entity, filters);
  const currentKey = exportFiltersKey(filters);

  const previewMatches = preview.kind === "ok" && preview.key === currentKey;
  const canDownload = !validationError && previewMatches && preview.data.will_export > 0;
  const stale = preview.kind === "ok" && !previewMatches;

  function update<K extends keyof ExportFormValues>(key: K, value: ExportFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runPreview() {
    if (validationError) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestId.current;
    const key = currentKey;
    setPreview({ kind: "loading" });

    try {
      const res = await fetch(`/api/export/${entity}/preview${key ? `?${key}` : ""}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; preview: PreviewData }
        | { ok: false; message?: string }
        | null;
      if (id !== requestId.current) return; // đã có lần xem trước mới hơn
      if (!res.ok || !body || !body.ok) {
        setPreview({
          kind: "error",
          message: exportHttpErrorMessage(res.status, body && !body.ok ? body.message : undefined),
        });
        return;
      }
      setPreview({ kind: "ok", key, data: body.preview });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      if (id !== requestId.current) return;
      setPreview({ kind: "error", message: "Không kết nối được máy chủ. Vui lòng thử lại." });
    }
  }

  function resetForm() {
    setForm(EMPTY_EXPORT_FORM);
    setCompanyName("");
  }

  const downloadHref = (format: ExportFormat) =>
    `/data-management/export/${entity}?${buildExportDownloadQuery(filters, format)}`;

  return (
    <section className="space-y-4" aria-label={`Xuất dữ liệu ${DATA_ENTITY_LABELS[entity]}`}>
      <div className="flex flex-wrap items-end gap-3">
        {support.status && (
          <label className="space-y-1 text-sm">
            <span className="block text-muted-foreground">Trạng thái</span>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className={FIELD}
            >
              <option value="">Mọi trạng thái</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {support.is_active && (
          <label className="space-y-1 text-sm">
            <span className="block text-muted-foreground">Hoạt động</span>
            <select
              value={form.isActive}
              onChange={(e) => update("isActive", e.target.value as ExportFormValues["isActive"])}
              className={FIELD}
            >
              <option value="">Cả hai</option>
              <option value="true">Còn hoạt động</option>
              <option value="false">Đã ngừng</option>
            </select>
          </label>
        )}

        {support.company_id && (
          <div className="space-y-1 text-sm">
            <span className="block text-muted-foreground">Công ty</span>
            <CompanyFilterCombobox
              initialId=""
              initialName={companyName}
              onChange={(hit) => {
                update("companyId", hit.id);
                setCompanyName(hit.name);
              }}
            />
          </div>
        )}

        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Lọc theo ngày</span>
          <select
            value={form.dateField}
            onChange={(e) => update("dateField", e.target.value as ExportDateField)}
            className={FIELD}
          >
            <option value="created_at">Ngày tạo</option>
            <option value="updated_at">Ngày cập nhật</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Từ ngày</span>
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => update("fromDate", e.target.value)}
            className={FIELD}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Đến ngày</span>
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => update("toDate", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Số dòng mới nhất tối đa</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.limit}
            onChange={(e) => update("limit", e.target.value)}
            placeholder="Không giới hạn"
            className={`${FIELD} w-40`}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Ngày tính theo giờ Việt Nam. Số dòng tối đa lấy các dòng mới nhất sau khi đã áp các bộ lọc khác.
      </p>

      {validationError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {validationError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={Boolean(validationError) || preview.kind === "loading"}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {preview.kind === "loading" ? "Đang xem trước…" : "Xem trước"}
        </button>

        {canDownload ? (
          <>
            <a
              href={downloadHref("xlsx")}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Tải Excel (.xlsx)
            </a>
            <a href={downloadHref("csv")} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              Tải CSV
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-50"
            >
              Tải Excel (.xlsx)
            </button>
            <button type="button" disabled className="rounded-md border px-3 py-2 text-sm font-medium opacity-50">
              Tải CSV
            </button>
          </>
        )}

        <button type="button" onClick={resetForm} className="rounded-md px-3 py-2 text-sm underline">
          Xóa lọc
        </button>
      </div>

      {preview.kind === "idle" && (
        <p className="text-sm text-muted-foreground">Bấm “Xem trước” để kiểm tra dữ liệu trước khi tải.</p>
      )}
      {stale && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          Bộ lọc đã thay đổi từ lần xem trước. Bấm “Xem trước” lại để bật nút tải.
        </p>
      )}
      {preview.kind === "error" && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {preview.message}
        </p>
      )}

      {preview.kind === "ok" && <PreviewTable data={preview.data} />}
    </section>
  );
}

function PreviewTable({ data }: { data: PreviewData }) {
  const rows = data.sample_rows ?? [];
  const limited = data.will_export < data.total_matching;
  return (
    <div className="space-y-2">
      <p className="text-sm" data-testid="export-summary">
        Có <strong>{data.total_matching}</strong> dòng khớp bộ lọc
        {limited ? (
          <>
            , file sẽ có <strong>{data.will_export}</strong> dòng mới nhất.
          </>
        ) : (
          <>, file sẽ có đủ {data.will_export} dòng.</>
        )}
      </p>
      {data.will_export === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          Không có dòng nào khớp bộ lọc, nên chưa có gì để tải.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Hiển thị {rows.length} dòng mẫu đầu tiên.</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {data.columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {data.columns.map((c) => (
                      <td key={c} className="max-w-xs truncate px-3 py-2" title={formatPreviewCell(row[c])}>
                        {formatPreviewCell(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
