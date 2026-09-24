// lib/jwt.ts
// Hàm decode JWT dùng chung giữa lib/session.ts (Node runtime, Server
// Component/Route Handler) và middleware.ts (Edge runtime) — tách riêng
// ra đây vì middleware.ts KHÔNG import được lib/session.ts (file đó
// import next/headers, chỉ dùng được trong ngữ cảnh render Server
// Component/Route Handler, không phải middleware). File này KHÔNG đụng
// next/headers hay bất kỳ API riêng Node nào (dùng atob() thay vì
// Buffer — Buffer không có sẵn trong Edge runtime) để chạy được ở cả 2
// nơi. (Round sửa refresh — quyết định ở chat238.txt/chat239.txt)
//
// CHỈ đọc phần payload (KHÔNG verify chữ ký — verify thật do backend làm
// khi request thật sự được gửi lên); ở đây chỉ dùng để quyết định có cần
// chủ động refresh trước hay chưa.

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

export function decodeJwtExp(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Coi là "sắp hết hạn" nếu còn dưới `bufferSeconds` giây (mặc định 30s)
 *  — chừa khoảng đệm cho thời gian request thật sự chạy tới lúc backend
 *  nhận được. */
export function isExpiredSoon(token: string, bufferSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (exp === null) return true; // không đọc được exp -> coi như hết hạn, an toàn hơn
  const nowSeconds = Date.now() / 1000;
  return exp - nowSeconds < bufferSeconds;
}
