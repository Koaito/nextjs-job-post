"use client";
// app/(app)/data-management/import-row-controls.tsx
// Ô điều khiển trên từng dòng preview: ô sửa lỗi tại chỗ, chọn level, chọn hành động.
//
// Ô sửa lỗi giữ bản nháp trong state CỤC BỘ: gõ phím không làm render lại cả bảng (không mất con trỏ
// khi bảng dài). Chỉ khi (a) ô đang "đã xác nhận" mà bị sửa -> báo reducer gỡ trạng thái xác nhận của
// đúng ô đó, (b) bấm "Xác nhận" và backend re-validate thành công -> mới coi là xong.
// Loại ô nhập (enum/date/number/email/text) và options lấy nguyên từ backend, không đoán theo tên field.

import { useState } from "react";
import type { FixCell } from "@/lib/data-ops/import-review";
import { actionOptionsFor, initialFixInputValue } from "@/lib/data-ops/import-ui";
import type { ImportPreviewRow, ImportResolutionAction } from "@/lib/data-ops/import";
import type { RowDecision } from "@/lib/data-ops/import-review";

const FIELD = "rounded-md border bg-background px-2 py-1 text-sm";

export function FixCellInput({
  field,
  cell,
  backendMessage,
  onEdited,
  onVerify,
}: {
  field: string;
  cell: FixCell;
  /** Message lỗi của backend lúc build preview, hiện NGUYÊN VĂN (không bóc tiền tố "Dòng N"). */
  backendMessage?: string;
  onEdited: (value: string) => void;
  /** Trả null nếu hợp lệ, hoặc message lỗi nguyên văn của backend. */
  onVerify: (value: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(() => initialFixInputValue(cell.widget, cell.value));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(value: string) {
    setDraft(value);
    setError(null);
    if (cell.verified) onEdited(value); // chỉ dispatch lúc chuyển đã-xác-nhận -> chưa-xác-nhận
  }

  async function verify() {
    setBusy(true);
    setError(await onVerify(draft));
    setBusy(false);
  }

  const inputType = cell.widget === "date" ? "date" : cell.widget === "number" ? "number" : cell.widget === "email" ? "email" : "text";

  return (
    <div className="space-y-1" data-testid={`fix-${field}`}>
      <label className="block text-xs font-medium text-muted-foreground">{field}</label>
      <div className="flex flex-wrap items-center gap-2">
        {cell.widget === "enum" && cell.options ? (
          <select
            value={draft}
            onChange={(e) => change(e.target.value)}
            aria-label={`Sửa ${field}`}
            className={FIELD}
          >
            <option value="">— chọn —</option>
            {cell.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={inputType}
            value={draft}
            onChange={(e) => change(e.target.value)}
            aria-label={`Sửa ${field}`}
            className={`${FIELD} w-48`}
          />
        )}
        <button
          type="button"
          onClick={verify}
          disabled={busy || draft.trim() === ""}
          className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {busy ? "Đang kiểm…" : "Xác nhận"}
        </button>
        {cell.verified && (
          <span className="text-xs font-medium text-emerald-600" data-testid={`fix-ok-${field}`}>
            ✓ Đã xác nhận
          </span>
        )}
      </div>
      {!cell.verified && (error ?? backendMessage) && (
        <p className="text-xs text-destructive">{error ?? backendMessage}</p>
      )}
    </div>
  );
}

export function LevelSelect({
  value,
  levels,
  rawLevel,
  onChange,
}: {
  value: string;
  levels: string[];
  rawLevel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">
        Level{rawLevel ? ` (trong file: “${rawLevel}” không hợp lệ)` : " không hợp lệ"}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Chọn lại level" className={FIELD}>
        <option value="">— chọn level —</option>
        {levels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ActionSelect({
  row,
  value,
  onChange,
}: {
  row: ImportPreviewRow;
  value: RowDecision;
  onChange: (action: ImportResolutionAction) => void;
}) {
  const options = actionOptionsFor(row);
  if (options.length === 0) return null;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as ImportResolutionAction)}
      aria-label={`Cách xử lý dòng ${row.row_index + 2}`}
      className={FIELD}
    >
      {value === null && <option value="">— chọn —</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
