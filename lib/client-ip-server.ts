// lib/client-ip-server.ts
// Bản dùng trong Server Component / Server Action / Route Handler: tự đọc
// headers() của request đang xử lý rồi trả header X-Client-IP để gắn vào
// lời gọi sang Scrap_JD. Xem lib/client-ip.ts về lý do và lưu ý triển khai.

import { headers } from "next/headers";
import { clientIpHeaders } from "@/lib/client-ip";

/**
 * Trả `{ "X-Client-IP": ip }`, hoặc `{}` khi không xác định được.
 *
 * Ngoài phạm vi request (script, test) headers() ném lỗi thường -> trả {}
 * để lời gọi vẫn chạy, chỉ mất phần rate limit theo IP thật. Lỗi nội bộ
 * của Next (có `digest`, vd DYNAMIC_SERVER_USAGE dùng để chuyển trang
 * sang render động) PHẢI ném tiếp, nuốt nó sẽ làm hỏng cơ chế đó.
 */
export async function getClientIpHeaders(): Promise<Record<string, string>> {
  try {
    return clientIpHeaders(await headers());
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return {};
  }
}
