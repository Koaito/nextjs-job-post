// lib/api/client.ts
// Tương đương _call_authed (helpers.py) + crawler_client/base.py bên Flask.
// NGUYÊN TẮC: chỉ viết callAuthed() đúng 1 lần duy nhất trong toàn bộ app.
// Mọi hàm trong lib/api/*.ts (jobs.ts, companies.ts...) đều gọi qua đây.
//
// Mục 3 (Pha B): session mờ — KHÔNG còn refresh/retry. Token trong cookie không hết hạn
// theo phút và không xoay vòng, nên một lời gọi chỉ cần đúng một lần gửi. 401 thuộc nhóm
// "phiên kết thúc" (session_replaced / session_revoked) được ném nguyên cho nơi gọi
// (getSessionState, route polling...) tự xử lý bằng sessionEndReasonFromCode.

import { getSessionToken } from "@/lib/session";
import { getClientIpHeaders } from "@/lib/client-ip-server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errorCode?: string,
    public params?: Record<string, string | number>,
    /** Nguyên object `detail` của backend (Dạng 1) — để đọc field ngoài
     *  error_code/message/params, vd mảng `errors` chi tiết từng dòng của
     *  422 import_row_validation_failed. Không có ở Dạng 2/3. */
    public detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Gọi thẳng Scrap_JD, không xử lý auth — chỉ lo phần forward
 * request + parse lỗi đúng 3 hình dạng JSON thật mà backend trả về.
 *
 * QUAN TRỌNG: FastAPI tự bọc lỗi trong "detail". Có 3 hình dạng:
 *   1. { detail: { error_code, message, params } }  -> lỗi nghiệp vụ đã chuẩn hoá (phổ biến nhất)
 *   2. { detail: [{ loc, msg, type }, ...] }          -> lỗi validate tự động của Pydantic (mảng)
 *   3. Không khớp 2 dạng trên (429 rate-limit, lỗi hạ tầng...) -> fallback message chung
 */
async function fetchOk(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<Response> {
  // Body là FormData (multipart, vd nộp CV — POST /me/applications) thì
  // TUYỆT ĐỐI không tự đặt Content-Type: fetch phải tự sinh header kèm
  // `boundary=...`, ép "application/json" sẽ làm backend không parse được
  // form. Mọi body khác vẫn mặc định JSON như cũ.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  // IP thật của người dùng cuối cho rate limit theo IP ở backend (plan
  // Phần 1 mục 3.14, xem lib/client-ip.ts). BỎ QUA với lời gọi có cache
  // (`next: { revalidate }` hoặc cache khác "no-store", vd /enums): header
  // nằm trong khoá cache của fetch, gắn IP mỗi người vào sẽ tách cache
  // thành từng mảnh theo người dùng; và lời gọi được cache dùng chung
  // cho mọi người nên không cần khoá theo IP.
  const hasRevalidate = init.next?.revalidate !== undefined;
  const isCached = hasRevalidate || (init.cache ?? "no-store") !== "no-store";
  const clientIp = isCached ? {} : await getClientIpHeaders();

  const res = await fetch(`${process.env.CRAWLER_API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "X-API-Key": process.env.CRAWLER_API_KEY!,
      ...clientIp,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    // Dữ liệu job/contact đổi liên tục -> mặc định không cache.
    // Từng lời gọi cụ thể ở lib/api/jobs.ts... có thể override nếu cần
    // ISR (revalidate: 60) hoặc cache enum (revalidate: 300) — xem Phần 4
    // mục 4 của plan.
    //
    // KHÔNG đặt `cache` khi caller đã truyền `next.revalidate`: Next.js
    // coi 2 tuỳ chọn này xung đột (cảnh báo `Specified "cache: no-store"
    // and "revalidate: 300", only one should be specified`) và bỏ qua
    // revalidate -> /enums bị gọi lại backend ở MỌI lần render thay vì
    // cache 5 phút như plan. `...init` ở trên đã mang sẵn `cache` nếu
    // caller tự truyền.
    ...(hasRevalidate ? {} : { cache: init.cache ?? "no-store" }),
  });

  if (!res.ok) {
    // Đọc body dạng text rồi tự JSON.parse (thay vì res.json().catch) để
    // còn nội dung thô mà log khi rơi vào Dạng 3 — body chỉ đọc được 1 lần.
    const raw = await res.text();
    let body: { detail?: unknown } = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // Body không phải JSON (HTML của proxy/Render, chữ thuần "Internal
      // Server Error"...) -> body rỗng, rơi xuống Dạng 3 bên dưới.
    }
    const detail = body?.detail as
      | { message?: string; error_code?: string; params?: Record<string, string | number> }
      | Array<{ msg?: string }>
      | string
      | undefined;

    // Dạng 1: detail là object có error_code -> lỗi nghiệp vụ chuẩn hoá
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      throw new ApiError(
        detail.message ?? "Lỗi không xác định",
        res.status,
        detail.error_code,
        detail.params,
        detail as Record<string, unknown>,
      );
    }

    // Dạng 2: detail là mảng -> lỗi validate Pydantic tự động
    if (Array.isArray(detail) && detail.length > 0) {
      throw new ApiError(
        detail[0]?.msg ?? "Dữ liệu gửi lên không hợp lệ.",
        res.status,
      );
    }

    // Dạng 3: không khớp (429 rate-limit, 404 detail dạng chuỗi, 5xx, HTML
    // hạ tầng...) -> ghi log phía server để biết status + body thật, rồi
    // fallback message chung. Chỉ cắt 300 ký tự; body lỗi không chứa token
    // (request mới mang token, response thì không).
    console.error(
      `[api] ${res.status} ${init.method ?? "GET"} ${path} -> ${raw.slice(0, 300)}`,
    );
    throw new ApiError("Lỗi không xác định", res.status);
  }

  return res;
}

/** fetchOk + parse JSON — cho mọi route trả JSON (đa số). */
async function rawFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetchOk(path, init, token);

  // Vài route trả 204 No Content (vd DELETE) -> không có body để parse
  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * Gọi API CẦN auth — hàm DUY NHẤT mọi module lib/api/*.ts dùng khi cần token. Gắn session
 * token từ cookie (nếu có) rồi gửi ĐÚNG MỘT LẦN; không refresh, không thử lại.
 *
 * Lỗi 401 (và mọi lỗi khác) được chuẩn hoá thành ApiError và ném nguyên. Hàm này KHÔNG xoá
 * cookie: Server Component không được ghi cookie, nên việc dọn cookie chết do tầng trình
 * duyệt / Route Handler đảm nhiệm (lib/session-end-client.ts, SessionEndListener).
 */
export async function callAuthed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getSessionToken();
  return rawFetch<T>(path, init, token ?? undefined);
}

/**
 * Giống callAuthed() nhưng trả nguyên `Response` (chưa đọc body) — cho
 * route trả FILE hoặc nhận body dạng stream (Nhóm 6: tải file export,
 * upload file import qua Route Handler). Lỗi (status >= 400) vẫn được
 * chuẩn hoá thành ApiError y hệt callAuthed().
 *
 * Nơi gọi chịu trách nhiệm đọc/forward body của Response (vd
 * `new Response(res.body, { headers })`) và copy đúng header cần thiết
 * (Content-Disposition, Content-Type). Vì không còn retry nên body dạng stream
 * không còn là trường hợp đặc biệt.
 */
export async function callAuthedStream(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getSessionToken();
  return fetchOk(path, init, token ?? undefined);
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
