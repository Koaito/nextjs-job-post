// lib/api/client.ts
// Tương đương _call_authed (helpers.py) + crawler_client/base.py bên Flask.
// NGUYÊN TẮC: chỉ viết callAuthed() đúng 1 lần duy nhất trong toàn bộ app.
// Mọi hàm trong lib/api/*.ts (jobs.ts, companies.ts...) đều gọi qua đây,
// không tự viết logic refresh riêng ở bất kỳ đâu khác.

import { getValidAccessToken, forceRefreshAccessToken } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errorCode?: string,
    public params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Gọi thẳng Scrap_JD, không xử lý auth/refresh — chỉ lo phần forward
 * request + parse lỗi đúng 3 hình dạng JSON thật mà backend trả về.
 *
 * QUAN TRỌNG: FastAPI tự bọc lỗi trong "detail". Có 3 hình dạng:
 *   1. { detail: { error_code, message, params } }  -> lỗi nghiệp vụ đã chuẩn hoá (phổ biến nhất)
 *   2. { detail: [{ loc, msg, type }, ...] }          -> lỗi validate tự động của Pydantic (mảng)
 *   3. Không khớp 2 dạng trên (429 rate-limit, lỗi hạ tầng...) -> fallback message chung
 */
async function rawFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${process.env.CRAWLER_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.CRAWLER_API_KEY!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    // Dữ liệu job/contact đổi liên tục -> mặc định không cache.
    // Từng lời gọi cụ thể ở lib/api/jobs.ts... có thể override nếu cần
    // ISR (revalidate: 60) hoặc cache enum (revalidate: 300) — xem Phần 4
    // mục 4 của plan.
    cache: init.cache ?? "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;

    // Dạng 1: detail là object có error_code -> lỗi nghiệp vụ chuẩn hoá
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      throw new ApiError(
        detail.message ?? "Lỗi không xác định",
        res.status,
        detail.error_code,
        detail.params,
      );
    }

    // Dạng 2: detail là mảng -> lỗi validate Pydantic tự động
    if (Array.isArray(detail) && detail.length > 0) {
      throw new ApiError(
        detail[0]?.msg ?? "Dữ liệu gửi lên không hợp lệ.",
        res.status,
      );
    }

    // Dạng 3: không khớp (429 rate-limit, lỗi hạ tầng...) -> fallback
    throw new ApiError("Lỗi không xác định", res.status);
  }

  // Vài route trả 204 No Content (vd DELETE) -> không có body để parse
  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * Gọi API CẦN auth — đây là hàm DUY NHẤT mọi module lib/api/*.ts phải
 * dùng khi cần token. 2 lớp refresh:
 *   1. Chủ động: getValidAccessToken() tự refresh theo `exp` đọc từ JWT
 *      (cơ chế chính, xem lib/session.ts).
 *   2. Phản ứng: nếu vẫn dính 401 sau đó (lệch giờ, token bị thu hồi
 *      ngoài dự kiến, trúng đúng khoảnh khắc hết hạn) -> refresh phản
 *      ứng đúng 1 lần rồi gọi lại request gốc đúng 1 lần. KHÔNG lặp vô hạn.
 *
 * Chỉ xoá cookie phiên khi refresh phản ứng CŨNG thất bại — không xoá
 * cookie cho 429/5xx/lỗi mạng, vì các lỗi đó không nói lên gì về tính
 * hợp lệ của phiên đăng nhập (xem Phần 2 mục 3 của plan).
 */
export async function callAuthed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getValidAccessToken();

  try {
    return await rawFetch<T>(path, init, accessToken ?? undefined);
  } catch (err) {
    // Chỉ retry khi lỗi thật sự là 401 do access token.
    // KHÔNG retry cho 429/5xx/lỗi mạng — refresh không sửa được các lỗi
    // này, và retry có thể khiến 1 lỗi tạm thời bị hiểu nhầm thành hết phiên.
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    const refreshedToken = await forceRefreshAccessToken();
    if (refreshedToken === null) {
      // Refresh phản ứng cũng thất bại -> đây là điểm DUY NHẤT lỗi 401
      // gốc được lan tiếp lên cho nơi gọi tự xử lý (redirect /login,
      // toast theo error_code — xem lib/auth-guard.ts và Phụ lục C).
      throw err;
    }

    // Thử lại đúng 1 lần, không catch tiếp (tránh lặp vô hạn).
    return rawFetch<T>(path, init, refreshedToken);
  }
}

/** Dùng cho các route KHÔNG cần auth nhưng vẫn cần X-API-Key (vd GET /sources,
 *  GET /jobs công khai, GET /jobs/data-health) — xem Nhóm 6, Phần 3 của plan
 *  về các route cố tình không đòi requireStaff(). */
export async function callPublic<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return rawFetch<T>(path, init);
}
