// lib/api/enums.ts
// Tương đương crawler_client/enums.py bên Flask — GET /enums là nguồn
// thật cho mọi enum backend (level_code, job_status, work_type...),
// KHÔNG hardcode level_code tĩnh ở đây (từng lệch tay 1 lần trước khi
// Flask đổi sang gọi GET /enums, 08/2026, xem lib/constants.ts).
//
// Cache 5 phút: bản Flask tự cài TTL cache thủ công (module-level dict
// + time.monotonic()) vì Python process sống lâu giữa các request.
// Next.js Server Component chạy theo request, không có "process sống
// lâu" tương đương để giữ cache tay như vậy — dùng thẳng cơ chế cache
// tích hợp sẵn của `fetch()` (`next: { revalidate }`, Next.js tự cache
// theo URL, không cần tự viết lại y hệt object cache thủ công của
// Flask).

import { callPublic } from "./client";

const LEVEL_CODES_FALLBACK = [
  "Intern",
  "Fresher",
  "Junior",
  "Middle",
  "Senior",
  "Lead",
  "Manager",
];

type EnumsResponse = Record<string, string[]>;

/**
 * 7 giá trị level_code hợp lệ. Lỗi gọi API (backend down/timeout) ->
 * rơi về LEVEL_CODES_FALLBACK để dropdown không trắng hẳn, KHÔNG throw
 * lên page — giống hệt hành vi get_level_codes() bên Flask.
 */
export async function getLevelCodes(): Promise<string[]> {
  try {
    const data = await callPublic<EnumsResponse>("/enums", {
      next: { revalidate: 300 },
    });
    const values = data.level_code;
    return values && values.length > 0 ? values : LEVEL_CODES_FALLBACK;
  } catch {
    return LEVEL_CODES_FALLBACK;
  }
}
