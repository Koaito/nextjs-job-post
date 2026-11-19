// POST /api/crawl/batch — bấm chạy crawl (tab Crawl của /crawl, Nhóm 6 phần 3c). CHỈ ADMIN.
//
// Hai tầng quyền của /crawl khác nhau (xem page.tsx): xem trang chỉ cần staff, còn route CHẠY crawl phải là admin
// (backend require_admin cũng chặn lần nữa). Cố ý KHÔNG dùng chung guard với các route đọc ở lib/crawl-route.ts.
// Thứ tự kiểm: nguồn gốc request (mutation dựa cookie) -> đăng nhập -> admin -> body -> backend.
//
// Rate limit backend: 10 lượt/giờ/người -> 429 (không có error_code). 409 crawl_already_active khi nguồn đang có
// lượt chạy dở. Cả hai được giữ nguyên status để client rẽ nhánh thông báo.

import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { triggerCrawlBatch } from "@/lib/api/crawl";
import { crawlFail, NO_STORE } from "@/lib/crawl-route";
import { crawlTriggerErrorMessage, validateCrawlBody } from "@/lib/data-ops/crawl-form";
import { getCurrentUser } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

/** Body hợp lệ chỉ vài trăm byte (tối đa 20 category); chặn sớm thứ to bất thường. */
const MAX_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  if (!verifyOrigin(req).ok) return crawlFail(403, "Yêu cầu không hợp lệ.");

  const user = await getCurrentUser();
  if (!user) return crawlFail(401, crawlTriggerErrorMessage(401));
  if (user.role !== "admin") return crawlFail(403, crawlTriggerErrorMessage(403));

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return crawlFail(413, crawlTriggerErrorMessage(413));
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return crawlFail(400, "Dữ liệu gửi lên không hợp lệ.");
  }
  const parsed = validateCrawlBody(body);
  if ("message" in parsed) return crawlFail(400, parsed.message);

  try {
    const accepted = await triggerCrawlBatch(parsed.request);
    return NextResponse.json(
      { ok: true, batchId: accepted.batch_id, firstRunId: accepted.first_run_id },
      { status: 202, headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      // 400 của backend (nguồn/category không tồn tại) có message tiếng Việt rõ ràng -> giữ làm fallback.
      return crawlFail(status, crawlTriggerErrorMessage(status, err.errorCode, err.message), err.errorCode);
    }
    return crawlFail(502, crawlTriggerErrorMessage(0));
  }
}
