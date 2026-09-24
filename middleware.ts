// middleware.ts
// ROUND SỬA REFRESH (chat237.txt phát hiện bug, chốt hướng ở
// chat238.txt/chat239.txt) — thay cho bản cũ "chỉ chặn sớm theo cookie".
//
// Bug của bản cũ (Hướng A — refresh chủ động chỉ nằm ở
// lib/session.ts::getValidAccessToken(), chạy trong Server Component):
// khi refresh xảy ra trong Server Component, cookie mới KHÔNG lưu được
// (Server Component chỉ được set cookie trong Server Action/Route
// Handler, không phải lúc render bình thường) -> request hiện tại vẫn
// chạy OK (dùng token mới nằm trong bộ nhớ), nhưng trình duyệt vẫn giữ
// refresh token CŨ đã bị backend thu hồi. Grace period 10s bên backend
// (api/security.py::REFRESH_REUSE_GRACE_SECONDS) cứu được nếu request
// kế tiếp đến trong 10 giây, nhưng user rời tab lâu hơn rồi quay lại sẽ
// bị văng đăng xuất oan — và lỗi này tăng dần theo số Server Component
// gọi song song (Round 6, Nhóm 2-6 sắp làm sẽ càng lộ rõ).
//
// Hướng B (chốt dùng): middleware — nơi DUY NHẤT chạy trước mọi render
// VÀ được phép ghi cookie response — tự gọi /auth/refresh khi access
// token hết hạn/sắp hết hạn, ghi lại cookie mới, trước khi cho request
// đi tiếp. Vẫn giữ đúng tinh thần "refresh chỉ 1 nơi" của plan (chỉ đổi
// vị trí từ lib/session.ts sang đây) — lib/session.ts::getValidAccessToken()
// giữ nguyên logic cũ, trở thành lớp dự phòng hiếm khi chạy (middleware bị
// skip do matcher, hoặc token hết hạn ngay giữa lúc render).
//
// Middleware chạy Edge runtime -> không dùng được next/headers (lib/
// session.ts), nên phần "decode JWT exp" dùng chung qua lib/jwt.ts (không
// đụng next/headers, chạy được cả Edge lẫn Node), còn phần gọi
// /auth/refresh gọi thẳng fetch() riêng ở đây (KHÔNG import lib/api/
// auth.ts để tránh kéo theo phụ thuộc không tương thích Edge).
//
// Phạm vi áp dụng: MỌI route (kể cả /jobs, /jobs/[id] công khai) — route
// public vẫn gọi getCurrentUser() ở layout để hiện nút "Thêm job"/"Lưu
// job" cho khách đã đăng nhập, nên cũng cần access token được refresh sẵn
// để không bị mất trạng thái đăng nhập khi ghé trang chủ (đối chiếu với
// Flask: load_user() của Flask-Login chạy mọi request, kể cả route
// public — xác nhận ở chat239.txt). Route public CHỈ khác route cần-login
// ở chỗ không bị redirect /login khi hoàn toàn thiếu cookie.

import { NextRequest, NextResponse } from "next/server";
import { isExpiredSoon } from "@/lib/jwt";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  COOKIE_OPTS,
} from "@/lib/auth-cookies";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// Xem danh sách/chi tiết job không cần đăng nhập — đúng như Flask
// (/, /jobs, /jobs/more, /jobs/<id> không có @login_required) và là
// điều kiện để SEO (Phần 4 mục 3) hoạt động.
// KHÔNG dùng startsWith("/jobs"): sẽ vô tình mở luôn /jobs/add và
// /jobs/[id]/edit.
function isPublicJobRoute(p: string): boolean {
  if (p === "/" || p === "/jobs" || p === "/jobs/more") return true;
  if (p === "/jobs/add") return false;
  return /^\/jobs\/[^/]+$/.test(p);
}

type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "invalid" | "error" };

/**
 * Gọi thẳng /auth/refresh bằng fetch() (không qua lib/api/auth.ts —
 * xem lý do ở comment đầu file). Phân biệt rõ 2 loại thất bại vì hệ quả
 * khác hẳn nhau:
 *   - "invalid" (401/403): backend đã XÁC NHẬN refresh token không hợp
 *     lệ/hết hạn/đã bị thu hồi thật (kể cả bị thu hồi do "nghi đánh cắp"
 *     — backend đã tự xử lý grace period 10s cho race hợp lệ ngay trong
 *     /auth/refresh, xem chat238.txt; còn trả 401/403 tới đây nghĩa là
 *     chắc chắn không phải race) -> phải dọn phiên thật sự.
 *   - "error" (429/5xx/timeout/mất mạng, kể cả backend Render đang "ngủ"
 *     — Phụ lục E của plan) -> lỗi hạ tầng tạm thời, KHÔNG nói lên gì về
 *     tính hợp lệ của phiên -> không được dọn cookie (đúng nguyên tắc ở
 *     lib/api/client.ts::callAuthed, chỉ xoá cookie khi refresh XÁC NHẬN
 *     token sai, không xoá vì lỗi hạ tầng).
 */
async function tryRefresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${process.env.CRAWLER_API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.CRAWLER_API_KEY!,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as { access_token: string; refresh_token: string };
      return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || isPublicJobRoute(pathname);

  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  let refreshToken = req.cookies.get(REFRESH_COOKIE)?.value ?? null;

  let newTokens: { access: string; refresh: string } | null = null;
  let shouldClearCookies = false;

  const needsRefresh = refreshToken !== null && (!accessToken || isExpiredSoon(accessToken));

  if (needsRefresh) {
    const result = await tryRefresh(refreshToken!);
    if (result.ok) {
      newTokens = { access: result.accessToken, refresh: result.refreshToken };
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
    } else if (result.reason === "invalid") {
      shouldClearCookies = true;
      accessToken = null;
      refreshToken = null;
    }
    // reason === "error": giữ nguyên accessToken/refreshToken hiện có
    // (dù accessToken có thể đã hết hạn) — nhường lại cho lớp dự phòng
    // getValidAccessToken()/forceRefreshAccessToken() ở Server Component
    // tự thử lại theo đúng nguyên tắc trên.
  }

  // Route cần-login: chặn sớm nếu sau tất cả vẫn không còn token nào
  // (chưa từng đăng nhập, hoặc refresh vừa xác nhận phiên đã chết hẳn).
  // Route public KHÔNG redirect trong mọi trường hợp — chỉ khác ở chỗ
  // này, phần refresh phía trên áp dụng như nhau cho cả 2 loại route.
  if (!isPublic && !accessToken && !refreshToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const redirectRes = NextResponse.redirect(loginUrl);
    if (shouldClearCookies) {
      redirectRes.cookies.delete(ACCESS_COOKIE);
      redirectRes.cookies.delete(REFRESH_COOKIE);
    }
    return redirectRes;
  }

  // Ghi token mới (nếu có) vào chính cookie của request này TRƯỚC khi
  // build requestHeaders, để Server Component phía sau (đọc qua
  // cookies() của next/headers, vd getValidAccessToken()) thấy token mới
  // NGAY trong cùng request này — không phải đợi round-trip kế tiếp mới
  // nhận qua Set-Cookie. req.cookies dùng chung 1 Headers instance với
  // req.headers nên set/delete ở đây tự phản ánh sang req.headers.
  if (newTokens) {
    req.cookies.set(ACCESS_COOKIE, newTokens.access);
    req.cookies.set(REFRESH_COOKIE, newTokens.refresh);
  } else if (shouldClearCookies) {
    req.cookies.delete(ACCESS_COOKIE);
    req.cookies.delete(REFRESH_COOKIE);
  }

  // Set header để lib/auth-guard.ts đọc lại pathname hiện tại trong
  // Server Component (Next.js không có API chính thức khác cho việc này).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-invoke-path", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Ghi Set-Cookie cho trình duyệt (để các request SAU của browser cũng
  // dùng token mới) — làm SONG SONG với việc ghi vào req.cookies ở trên,
  // không thay thế cho nhau: req.cookies chỉ ảnh hưởng request hiện tại,
  // response.cookies mới là thứ trình duyệt thực sự nhận được.
  if (newTokens) {
    response.cookies.set(ACCESS_COOKIE, newTokens.access, {
      ...COOKIE_OPTS,
      maxAge: ACCESS_MAX_AGE,
    });
    response.cookies.set(REFRESH_COOKIE, newTokens.refresh, {
      ...COOKIE_OPTS,
      maxAge: REFRESH_MAX_AGE,
    });
  } else if (shouldClearCookies) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }

  return response;
}

export const config = {
  matcher: [
    // Áp dụng cho mọi route trừ static file, ảnh, favicon, API Route
    // Handler nội bộ của Next.js (_next/*) — API auth tự lo phần xác
    // thực riêng, không cần middleware can thiệp.
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
