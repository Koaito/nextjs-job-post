// app/(app)/students/cv/[applicationId]/route.ts
// Tương đương blueprints/students.py::cv_download() (Flask) —
// GET /students/cv/<application_id>. Nhóm 3, Đợt 3.3, Phần 4/4.
//
// Staff bấm "📄 Tải CV ứng tuyển" ở /student-activity/[id] -> route này
// xin signed URL (Supabase Storage, hết hạn ~1 giờ) từ backend rồi
// redirect 302 thẳng tới đó. KHÔNG đọc/stream file qua server trung gian
// (plan Nhóm 3). Hàm API nền getApplicantCvUrl() là hàm DÙNG CHUNG với
// nút "Xem CV" ở trang chi tiết job (lib/api/applications.ts, route
// backend /jobs/applications/{id}/cv-url) — không viết thêm lệnh gọi nào.
//
// Khác route Nhóm 5 `GET /me/applications/{id}/cv-url` (học viên xem CV
// của CHÍNH MÌNH): route này chỉ cho STAFF xem CV của người khác.
//
// Quyền: requireStaff() — khớp login_required + `if not is_staff: abort(403)`
// (chưa đăng nhập -> /login?next=..., không phải staff -> 404 như mọi
// route staff khác). proxy.ts vẫn chạy cho đường dẫn này (matcher chỉ
// loại api/), nên token hết hạn được refresh trước khi vào đây.
//
// Lỗi (không có CV / quá nhanh / backend lỗi): Flask flash rồi redirect
// về trang trước, nhưng link này mở ở TAB MỚI (target="_blank") nên
// "về trang trước" sẽ biến tab mới thành bản sao trang danh sách. Thay
// vào đó trả 1 trang HTML ngắn kèm mã lỗi đúng + link quay lại để staff
// đóng tab hoặc về /student-activity.
//
// Không cache: signed URL hết hạn, mỗi lần bấm phải xin lại.

import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import { getApplicantCvUrl } from "@/lib/api/applications";

export const dynamic = "force-dynamic";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorPage(message: string, status: number): Response {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Không tải được CV — MindX Career Hub</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1a2b24}
  p.err{background:#fdecec;color:#b42318;padding:.75rem 1rem;border-radius:.5rem}
  a{color:inherit}
</style>
</head>
<body>
<h1>Không tải được CV</h1>
<p class="err" role="alert">${escapeHtml(message)}</p>
<p><a href="/student-activity">← Hoạt động học viên</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  await requireStaff();
  const { applicationId } = await params;

  let signedUrl: string;
  try {
    signedUrl = await getApplicantCvUrl(applicationId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return errorPage("Học viên chưa nộp CV cho đơn này.", 404);
    }
    if (err instanceof ApiError && err.status === 429) {
      return errorPage("Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.", 429);
    }
    const message = err instanceof ApiError ? err.message : "Không thể tạo link tải CV lúc này.";
    return errorPage(message, 502);
  }

  // Backend không trả URL (Flask: `if not signed_url`) hoặc trả thứ không
  // phải http(s) -> không redirect mù quáng tới giá trị lạ.
  let target: URL | null = null;
  try {
    target = signedUrl ? new URL(signedUrl) : null;
  } catch {
    target = null;
  }
  if (!target || (target.protocol !== "https:" && target.protocol !== "http:")) {
    return errorPage("Không thể tạo link tải CV lúc này.", 502);
  }

  // 302 (như Flask redirect()), không phải mặc định 307 của NextResponse.
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
