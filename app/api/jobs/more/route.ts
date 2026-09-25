// app/api/jobs/more/route.ts
// Round 6 (Nhóm 1, phần còn thiếu) — Route Handler cho <InfiniteJobList>
// (chế độ "Cuộn liên tục"), tương đương GET /jobs/more bên Flask
// (blueprints/jobs.py::more()). KHÁC Flask ở chỗ trả JSON job CARD DATA
// (mảng JobCardData, cùng shape <JobCard> nhận ở app/(app)/jobs/page.tsx)
// thay vì fragment HTML render sẵn (_job_card.html) — vì đây là React
// Client Component tự render lại card, không phải Jinja render fragment
// rồi nhét thẳng vào DOM như Flask.
//
// Dùng CHUNG đúng 1 bộ filter (q/industry/level/location/status) với
// app/(app)/jobs/page.tsx — cả 2 đều build JobFilters từ query string
// theo đúng cùng quy tắc (status rỗng -> mặc định "Đang tuyển", xem
// lib/api/jobs.ts::buildJobQuery), đảm bảo chế độ Phân trang/Cuộn liên
// tục luôn ra cùng 1 tập kết quả khi cùng bộ lọc — khớp _index_filters()
// dùng chung cho cả index()/more() bên Flask.
//
// Batch size = JOBS_PER_PAGE (20) — Flask có hằng số riêng
// JOBS_INFINITE_BATCH nhưng đang CHỌN CÙNG giá trị 20 với JOBS_PER_PAGE
// (xem comment ở blueprints/jobs.py), nên Next.js dùng thẳng 1 hằng số
// chung, không tách thêm 1 tên khác cho cùng 1 con số.
//
// Route PUBLIC (GET /jobs không cần đăng nhập) -> callPublic() qua
// listJobsCursor(), KHÔNG cần verifyOrigin() (chỉ bắt buộc cho route
// mutation dựa vào cookie — Phần 2 mục 6 của plan); route này chỉ đọc,
// không đổi state gì.

import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { listJobsCursor, toJobCardData, type JobFilters } from "@/lib/api/jobs";
import { JOBS_PER_PAGE } from "@/lib/constants";

// Dữ liệu job đổi liên tục + phụ thuộc query string -> không cache,
// khớp chiến lược cache của GET /jobs (Phần 4 mục 4 của plan).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Khớp more() bên Flask: thiếu/rỗng cursor -> coi như hết job, trả
  // ngay không gọi backend. Trang đầu tiên (+ next_cursor đầu tiên) luôn
  // tới từ app/(app)/jobs/page.tsx lúc render — route này chỉ phục vụ
  // các lần "Tải thêm" SAU đó, luôn có cursor thật; đây chỉ là lớp an
  // toàn nếu <InfiniteJobList> lỡ gọi thiếu cursor.
  const cursor = params.get("cursor");
  if (!cursor) {
    return NextResponse.json({ jobs: [], next_cursor: null });
  }

  const filters: JobFilters = {
    q: (params.get("q") ?? "").trim(),
    industry: params.get("industry") ?? "",
    level: params.get("level") ?? "",
    location: params.get("location") ?? "",
    status: params.get("status") ?? "",
  };

  try {
    const data = await listJobsCursor(filters, { limit: JOBS_PER_PAGE, cursor });
    return NextResponse.json({
      jobs: data.items.map(toJobCardData),
      next_cursor: data.next_cursor ?? null,
    });
  } catch (err) {
    // Khớp tinh thần more() bên Flask (trả 400 kèm {error: message} khi
    // CrawlerAPIError) — mở rộng thêm giữ đúng status code thật nếu có
    // (429 rate-limit, 422 cursor sai định dạng...), chỉ quy về 502 khi
    // không phải lỗi nghiệp vụ đã chuẩn hoá (lỗi mạng/hạ tầng).
    const status = err instanceof ApiError && err.status ? err.status : 502;
    const message = err instanceof ApiError ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status });
  }
}
