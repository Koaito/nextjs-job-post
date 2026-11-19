// GET /api/maintenance/logs-batch?run_ids=a,b&after_ids=0,5 — GỘP log của nhiều run (5 khung "Log live" tab Bảo trì)
// thành MỘT request. Hai chuỗi phân cách dấu phẩy, khớp CHẶT theo vị trí; ở đây dựng cursor từ đúng hai chuỗi đó
// rồi để getMaintenanceLogsBatch sinh lại cặp chuỗi cùng một lúc (không thể lệch nhau).
import type { NextRequest } from "next/server";
import { getMaintenanceLogsBatch, type MaintenanceLogCursor } from "@/lib/api/maintenance";
import { crawlFail, crawlReadRoute, isUuid, parseLogLimit } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

/** 5 job_type -> tối đa 5 khung; chừa dư cho job mới backend thêm. */
const MAX_CURSORS = 10;

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const runIds = (sp.get("run_ids") ?? "").split(",").filter(Boolean);
  const afterIds = (sp.get("after_ids") ?? "").split(",");
  if (runIds.length === 0) return crawlFail(400, "Thiếu run_ids.");
  if (runIds.length > MAX_CURSORS) return crawlFail(400, "Quá nhiều lượt chạy trong một lần gọi.");
  if (runIds.length !== afterIds.length) return crawlFail(400, "run_ids và after_ids phải cùng số lượng.");

  const cursors: MaintenanceLogCursor[] = [];
  for (let i = 0; i < runIds.length; i += 1) {
    if (!isUuid(runIds[i]) || !/^\d{1,12}$/.test(afterIds[i])) return crawlFail(400, "Tham số log không hợp lệ.");
    cursors.push({ runId: runIds[i], afterId: Number(afterIds[i]) });
  }
  const limit = parseLogLimit(sp.get("limit"));
  if (limit === null) return crawlFail(400, "Tham số log không hợp lệ.");
  return crawlReadRoute(() => getMaintenanceLogsBatch(cursors, limit));
}
