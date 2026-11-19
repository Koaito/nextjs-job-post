"use client";
// app/(app)/data-management/import-panel.tsx
// Tab "Nhập dữ liệu" (Nhóm 6, phần 2/3). Luồng: chọn file -> xem lại preview -> xử lý dòng cần xử lý
// (sửa ô lỗi, chọn công ty, chọn level, xử lý trùng) -> ghi chú -> xác nhận.
// Toàn bộ trạng thái nằm ở MỘT reducer thuần (lib/data-ops/import-review.ts), không rải nhiều biến rời.
// Sau khi nhập xong ở lại tab này, form về trống để nhập file tiếp; kết quả hiện ở đầu khung.

import { useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DataEntityType } from "@/lib/data-ops/export-filters";
import { summarizeImportRowErrors, IMPORT_MAX_ROWS } from "@/lib/data-ops/import";
import {
  ImportClientError,
  confirmImportRequest,
  uploadImportFile,
} from "@/lib/data-ops/import-client";
import {
  INITIAL_FLOW_STATE,
  buildConfirmResolutions,
  importFlowReducer,
} from "@/lib/data-ops/import-review";
import {
  IMPORT_ACCEPT,
  IMPORT_REQUIRED_COLUMNS,
  formatImportResult,
  validateImportFile,
} from "@/lib/data-ops/import-ui";
import { DATA_ENTITY_LABELS } from "@/lib/data-ops/export-ui";
import { ImportReviewView } from "./import-review-view";

export function ImportPanel({ entity, levelCodes }: { entity: DataEntityType; levelCodes: string[] }) {
  const [state, dispatch] = useReducer(importFlowReducer, INITIAL_FLOW_STATE);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0); // đổi key để xoá ô chọn file
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0] ?? null;
    const problem = validateImportFile(file);
    setFileError(problem);
    if (problem || !file) return;
    dispatch({ type: "upload_started" });
    try {
      const preview = await uploadImportFile(entity, file);
      dispatch({ type: "upload_succeeded", preview });
    } catch (err) {
      dispatch({
        type: "upload_failed",
        message: err instanceof Error ? err.message : "Không tải được file.",
        rowErrors: err instanceof ImportClientError ? (err.rowErrors ?? null) : null,
      });
    }
  }

  async function confirm() {
    if (!state.review) return;
    dispatch({ type: "confirm_started" });
    try {
      const result = await confirmImportRequest(entity, {
        previewId: state.review.preview.preview_id,
        note: state.review.note,
        resolutions: buildConfirmResolutions(state.review),
      });
      setFileKey((k) => k + 1);
      dispatch({ type: "confirm_succeeded", result });
    } catch (err) {
      if (err instanceof ImportClientError && err.previewGone) {
        setFileKey((k) => k + 1);
        dispatch({ type: "preview_lost", message: err.message });
      } else {
        dispatch({ type: "confirm_failed", message: err instanceof Error ? err.message : "Không nhập được dữ liệu." });
      }
    }
  }

  const label = DATA_ENTITY_LABELS[entity];

  if (state.stage === "review" && state.review) {
    return (
      <ImportReviewView
        entity={entity}
        review={state.review}
        confirming={state.busy === "confirm"}
        error={state.error}
        levelCodes={levelCodes}
        dispatch={dispatch}
        onConfirm={confirm}
        onCancel={() => {
          setFileKey((k) => k + 1);
          dispatch({ type: "cancel_review" });
        }}
        onGone={(message) => {
          setFileKey((k) => k + 1);
          dispatch({ type: "preview_lost", message });
        }}
      />
    );
  }

  const shown = state.rowErrors ? summarizeImportRowErrors(state.rowErrors) : null;

  return (
    <section className="space-y-4" aria-label={`Nhập dữ liệu ${label}`}>
      {state.result && (
        <p role="status" className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400" data-testid="import-result">
          Đã nhập xong. {formatImportResult(state.result)}
        </p>
      )}

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="block text-muted-foreground">File {label} (CSV hoặc XLSX)</span>
          <input
            key={fileKey}
            ref={fileRef}
            type="file"
            accept={IMPORT_ACCEPT}
            onChange={() => setFileError(null)}
            data-testid="import-file"
            className="mt-1 block text-sm"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Tối đa {IMPORT_MAX_ROWS} dòng mỗi lần. Cột bắt buộc: {IMPORT_REQUIRED_COLUMNS[entity].join(", ")}. Dòng
          trùng và dòng có ô lỗi sẽ được xử lý ở bước xem lại, chưa ghi gì vào hệ thống cho tới khi bạn xác nhận.
        </p>
      </div>

      {(fileError || state.error) && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="import-upload-error">
          {fileError ?? state.error}
        </p>
      )}

      {shown && (
        <div className="space-y-1 rounded-md border border-destructive/30 p-3 text-sm" data-testid="import-row-errors">
          <p className="font-medium">Các dòng lỗi (không nhập gì cả, hãy sửa file rồi tải lại):</p>
          <ul className="list-disc pl-5">
            {shown.shown.map((e, i) => (
              <li key={i}>
                Dòng {e.row_number}
                {e.field_name ? `, cột ${e.field_name}` : ""}: {e.message}
              </li>
            ))}
          </ul>
          {shown.hiddenCount > 0 && <p className="text-muted-foreground">… và {shown.hiddenCount} dòng lỗi khác.</p>}
        </div>
      )}

      <Button type="button" onClick={upload} disabled={state.busy === "upload"} data-testid="import-upload">
        {state.busy === "upload" ? "Đang đọc file…" : "Tải lên và xem trước"}
      </Button>
    </section>
  );
}
