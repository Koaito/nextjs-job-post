// lib/client-ip.ts
// Lấy IP THẬT của người dùng cuối từ request đến Next.js, để chuyển tiếp
// sang Scrap_JD qua header X-Client-IP (Phần 1 mục 3.14 của plan).
//
// VÌ SAO CẦN: Scrap_JD chỉ thấy IP của server Next.js (Vercel), nên rate
// limit theo IP ở backend (GET /companies, GET /jobs, /auth/login,
// /auth/register...) bị dùng chung cho MỌI người dùng. Backend chỉ tin
// header này khi request có X-API-Key hợp lệ (api/rate_limit.py::
// get_client_ip) — API key chỉ nằm phía server nên trình duyệt không tự
// khai IP giả được.
//
// File này THUẦN (không import next/headers) để dùng được cả trong
// middleware (Edge) lẫn Route Handler. Bản đọc headers() của request
// hiện tại nằm ở lib/client-ip-server.ts.
//
// LƯU Ý TRIỂN KHAI: trên Vercel, x-real-ip / x-forwarded-for do Vercel
// tự gán và ghi đè giá trị client gửi lên nên tin được. Nếu sau này
// deploy ở nơi khác (VPS, Docker...), reverse proxy phía trước PHẢI ghi
// đè 2 header này, nếu không người dùng tự gửi x-forwarded-for giả sẽ
// đổi được khoá rate limit của chính mình.

export const CLIENT_IP_HEADER = "X-Client-IP";

// Chỉ ký tự có thể xuất hiện trong IPv4/IPv6 dạng văn bản; backend kiểm
// tra lại bằng thư viện ipaddress, đây chỉ là lớp lọc rác rẻ tiền.
const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

/** IP người dùng cuối, hoặc null nếu không xác định được. */
export function extractClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-real-ip"),
    // x-forwarded-for có thể là chuỗi "client, proxy1, proxy2" — lấy phần tử đầu.
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && IP_PATTERN.test(ip)) return ip;
  }
  return null;
}

/** Spread thẳng vào `headers: {...}` của fetch; rỗng nếu không có IP. */
export function clientIpHeaders(headers: Headers): Record<string, string> {
  const ip = extractClientIp(headers);
  return ip ? { [CLIENT_IP_HEADER]: ip } : {};
}
