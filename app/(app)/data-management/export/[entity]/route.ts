// app/(app)/data-management/export/[entity]/route.ts
// GET /data-management/export/{entity}?<bộ lọc>&format=xlsx|csv — tải file (Nhóm 6, phần 1/3).
//
// Trình duyệt ĐIỀU HƯỚNG thẳng tới đây (thẻ <a>), không dựng luồng blob thủ công. Route chỉ
// forward body của backend THEO STREAM cùng Content-Disposition mà backend đã đặt sẵn (tên file,
// charset) — không đọc cả file vào bộ nhớ. Đặt dưới (app)/ như route tải CV để proxy.ts vẫn chạy.
//
// Quyền: requireStaff() (chưa đăng nhập -> /login?next=..., không phải staff -> 404).
// Backend chặn formula injection (E2: CSV thêm `'` trước ô nguy hiểm) — route này không đụng nội dung.
//
// Lỗi (bộ lọc sai / quá nhanh / backend lỗi): mở ở cùng tab nên trả trang HTML ngắn có mã lỗi
// đúng + link quay lại, không để trình duyệt tải về một file JSON lỗi.

import { requireStaff } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import { downloadExport } from "@/lib/api/import-export";
import {
  isDataEntityType,
  isExportFormat,
  parseExportFilters,
  validateExportFilters,
} from "@/lib/data-ops/export-filters";
import { exportHttpErrorMessage } from "@/lib/data-ops/export-ui";

export const dynamic = "force-dynamic";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorPage(message: string, status: number, backHref: string): Response {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Không tải được file — MindX Career Hub</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1a2b24}
  p.err{background:#fdecec;color:#b42318;padding:.75rem 1rem;border-radius:.5rem}
  a{color:inherit}
</style>
</head>
<body>
<h1>Không tải được file</h1>
<p class="err" role="alert">${escapeHtml(message)}</p>
<p><a href="${escapeHtml(backHref)}">← Xuất / Nhập dữ liệu</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  await requireStaff();
  const { entity } = await params;
  if (!isDataEntityType(entity)) {
    return errorPage("Loại dữ liệu không tồn tại.", 404, "/data-management");
  }
  const back = `/data-management?entity=${entity}`;

  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "xlsx";
  if (!isExportFormat(format)) return errorPage("Định dạng file chỉ nhận xlsx hoặc csv.", 400, back);

  let filters;
  try {
    filters = parseExportFilters(sp);
  } catch (err) {
    return errorPage(err instanceof Error ? err.message : "Bộ lọc không hợp lệ.", 400, back);
  }
  const invalid = validateExportFilters(entity, filters);
  if (invalid) return errorPage(invalid, 400, back);

  let upstream: Response;
  try {
    upstream = await downloadExport(entity, filters, format);
  } catch (err) {
    if (err instanceof ApiError) {
      return errorPage(exportHttpErrorMessage(err.status, err.message), err.status ?? 502, back);
    }
    return errorPage("Không kết nối được máy chủ dữ liệu.", 502, back);
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  // Chỉ chép đúng header cần thiết; không chuyển tiếp header nội bộ của backend.
  for (const name of ["Content-Type", "Content-Disposition", "Content-Length"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(upstream.body, { status: 200, headers });
}
