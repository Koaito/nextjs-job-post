// app/(app)/crawl/maintenance-tab.tsx
// Tab "Bảo trì" (Server Component): dựng NGAY trong lần tải đầu — run gần nhất của mỗi job (GET
// /maintenance/latest-log-runs, một lời gọi cho cả 5 job) để mỗi thẻ có trạng thái/kết quả ngay, không có trạng thái
// loading thừa. Phần tương tác + polling nằm ở MaintenancePanel (Client Component).
//
// Quyền: staff xem toàn bộ; form bấm chạy chỉ hiện cho admin (route POST cũng chặn lần nữa).

import { ApiError } from "@/lib/api/client";
import { getLatestMaintenanceRuns } from "@/lib/api/maintenance";
import { MaintenancePanel } from "./maintenance-panel";

export async function MaintenanceTab({ isAdmin }: { isAdmin: boolean }) {
  let initialRuns = null;
  try {
    initialRuns = await getLatestMaintenanceRuns();
  } catch (err) {
    // Hết phiên / bị đăng nhập nơi khác: để cơ chế chung xử lý, đừng nuốt thành "lỗi tải".
    if (err instanceof ApiError && err.status === 401) throw err;
  }
  return <MaintenancePanel isAdmin={isAdmin} initialRuns={initialRuns} />;
}
