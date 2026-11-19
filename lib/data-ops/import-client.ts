// lib/data-ops/import-client.ts
// Lời gọi các Route Handler /api/import/** từ TRÌNH DUYỆT (Client Component). Không import server-only.
// Mọi hàm trả `{ ok: true, ... }` hoặc ném ImportClientError với message tiếng Việt đã sẵn để hiện,
// kèm status/code để nơi gọi rẽ nhánh (vd bỏ cả preview khi hết hạn) mà KHÔNG đọc nội dung message.
//
// Body lỗi không phải JSON (vd HTML 413 của Vercel khi file quá lớn) vẫn ra thông báo đúng theo status.

import type { DataEntityType } from "./export-filters";
import type {
  ImportCompanySuggestion,
  ImportConfirmResult,
  ImportPreview,
  ImportPreviewRow,
  ImportResolutions,
  ImportRowError,
} from "./import";
import { importHttpErrorMessage, isPreviewGone } from "./import-ui";

export class ImportClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    /** Mảng lỗi cấp dòng của 422 (file bị từ chối hoàn toàn). */
    public rowErrors?: ImportRowError[],
  ) {
    super(message);
    this.name = "ImportClientError";
  }

  /** Preview hết hạn / không còn: nơi gọi nên bỏ cả preview và cho tải file lại. */
  get previewGone(): boolean {
    return isPreviewGone(this.status, this.code);
  }
}

type Fetcher = typeof fetch;

interface OkBody {
  ok: true;
  [key: string]: unknown;
}
interface ErrBody {
  ok: false;
  message?: string;
  code?: string;
  errors?: unknown[];
}

async function request(fetcher: Fetcher, url: string, init: RequestInit): Promise<OkBody> {
  let res: Response;
  try {
    res = await fetcher(url, { cache: "no-store", ...init });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") throw err;
    throw new ImportClientError("Không kết nối được máy chủ. Vui lòng thử lại.", 0);
  }
  const body = (await res.json().catch(() => null)) as OkBody | ErrBody | null;
  if (res.ok && body && body.ok === true) return body;

  const err = body && body.ok === false ? body : undefined;
  throw new ImportClientError(
    err?.message || importHttpErrorMessage(res.status, err?.code),
    res.status,
    err?.code,
    Array.isArray(err?.errors) ? (err.errors as ImportRowError[]) : undefined,
  );
}

const base = (entity: DataEntityType) => `/api/import/${encodeURIComponent(entity)}`;
const previewBase = (entity: DataEntityType, previewId: string) =>
  `${base(entity)}/preview/${encodeURIComponent(previewId)}`;

export async function uploadImportFile(
  entity: DataEntityType,
  file: File,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<ImportPreview> {
  // FormData: trình duyệt tự đặt Content-Type kèm boundary, KHÔNG tự đặt header này.
  const form = new FormData();
  form.append("file", file);
  const body = await request(fetcher, `${base(entity)}/preview`, { method: "POST", body: form, signal });
  return body.preview as ImportPreview;
}

export async function fetchImportPreview(
  entity: DataEntityType,
  previewId: string,
  fetcher: Fetcher = fetch,
): Promise<ImportPreview> {
  const body = await request(fetcher, previewBase(entity, previewId), { method: "GET" });
  return body.preview as ImportPreview;
}

export async function fetchCompanySuggestions(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
  fetcher: Fetcher = fetch,
): Promise<ImportCompanySuggestion[]> {
  const body = await request(
    fetcher,
    `${previewBase(entity, previewId)}/company-suggestions?row_index=${rowIndex}`,
    { method: "GET" },
  );
  return (body.suggestions as ImportCompanySuggestion[]) ?? [];
}

export interface VerifyFieldOutcome {
  row: ImportPreviewRow;
  /** null = ô hợp lệ và đã lưu vào preview; có giá trị = còn lỗi (message nguyên văn backend). */
  fieldError: { rule: string; message: string } | null;
}

export async function verifyField(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
  fieldName: string,
  value: string,
  fetcher: Fetcher = fetch,
): Promise<VerifyFieldOutcome> {
  const body = await request(fetcher, `${previewBase(entity, previewId)}/rows/${rowIndex}/verify-field`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field_name: fieldName, value }),
  });
  return {
    row: body.row as ImportPreviewRow,
    fieldError: (body.field_error as VerifyFieldOutcome["fieldError"]) ?? null,
  };
}

export async function resolveCompany(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
  companyId: string | null,
  fetcher: Fetcher = fetch,
): Promise<ImportPreviewRow> {
  const body = await request(fetcher, `${previewBase(entity, previewId)}/rows/${rowIndex}/resolve-company`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: companyId }),
  });
  return body.row as ImportPreviewRow;
}

export async function confirmImportRequest(
  entity: DataEntityType,
  input: { previewId: string; note: string; resolutions: ImportResolutions },
  fetcher: Fetcher = fetch,
): Promise<ImportConfirmResult> {
  const body = await request(fetcher, `${base(entity)}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preview_id: input.previewId,
      note: input.note.trim(),
      resolutions: input.resolutions,
    }),
  });
  return body.result as ImportConfirmResult;
}
