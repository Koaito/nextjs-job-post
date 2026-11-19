// POST /api/maintenance/{jobType} — bấm chạy một job bảo trì (tab Bảo trì của /crawl, Nhóm 6 phần 3d). CHỈ ADMIN.
//
// Cùng hai tầng quyền như route crawl (xem app/api/crawl/batch/route.ts): xem trang chỉ cần staff, còn route CHẠY job
// phải là admin (backend require_admin cũng chặn lần nữa). Cố ý KHÔNG dùng chung guard với các route đọc.
// Thứ tự kiểm: nguồn gốc request (mutation dựa cookie) -> đăng nhập -> admin -> job_type và body -> backend.
//
// Segment động [jobType] nằm cạnh các segment tĩnh (runs, latest-runs, logs-batch). Next ưu tiên segment tĩnh nên không
// đè nhau; và các route tĩnh kia chỉ có GET, còn POST tới chúng không tới đây.
//
// Rate limit backend: 10 lượt/giờ/người -> 429 (không có error_code). 409 maintenance_already_active khi job này đang
// có lượt chạy dở. Cả hai giữ nguyên status để client rẽ nhánh thông báo.

import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { triggerMaintenanceRun } from "@/lib/api/maintenance";
import { crawlFail, NO_STORE } from "@/lib/crawl-route";
import { maintenanceTriggerErrorMessage, validateMaintenanceBody } from "@/lib/data-ops/maintenance-form";
import { getCurrentUser } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

/** Body hợp lệ chỉ vài chục byte (3 field); chặn sớm thứ to bất thường. */
const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobType: string }> }) {
  if (!verifyOrigin(req).ok) return crawlFail(403, "Yêu cầu không hợp lệ.");

  const user = await getCurrentUser();
  if (!user) return crawlFail(401, maintenanceTriggerErrorMessage(401));
  if (user.role !== "admin") return crawlFail(403, maintenanceTriggerErrorMessage(403));

  const { jobType } = await ctx.params;
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return crawlFail(413, maintenanceTriggerErrorMessage(413));
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return crawlFail(400, "Dữ liệu gửi lên không hợp lệ.");
  }
  const parsed = validateMaintenanceBody(jobType, body);
  if ("message" in parsed) return crawlFail(400, parsed.message);

  try {
    const accepted = await triggerMaintenanceRun(parsed.jobType, parsed.request);
    return NextResponse.json(
      { ok: true, runId: accepted.run_id, jobType: accepted.job_type },
      { status: 202, headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      // 400 của backend có message tiếng Việt rõ ràng -> giữ làm fallback.
      return crawlFail(status, maintenanceTriggerErrorMessage(status, err.errorCode, err.message), err.errorCode);
    }
    return crawlFail(502, maintenanceTriggerErrorMessage(0));
  }
}
