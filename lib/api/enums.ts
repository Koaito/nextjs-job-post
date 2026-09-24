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

// Hai giá trị KHÔNG phải tỉnh thật nhưng backend cho chọn (PROVINCE_VALUES
// ở Scrap_JD/constants.py) — luôn xếp cuối danh sách, sau các tỉnh đã sort.
const PROVINCES_PINNED_LAST = ["Khác", "Remote"];

/**
 * Danh sách tỉnh/thành HỢP LỆ để chọn ở form job + filter /jobs (plan
 * Phần 1 mục 3.4: province_name là bảng tra cứu cố định, không cho gõ tự
 * do — tên gõ sai bị backend âm thầm gán "Khác"). Lấy từ GET /enums
 * (`province_name`, 34 tỉnh sau sáp nhập + "Khác"/"Remote"), cache 5 phút
 * như getLevelCodes (Phần 4 mục 4).
 *
 * Backend trả theo thứ tự seed Bắc -> Nam nên sort lại theo bảng chữ cái
 * tiếng Việt cho dễ tìm; "Khác"/"Remote" ghim cuối.
 *
 * Lỗi gọi API -> trả mảng rỗng (KHÔNG hardcode lại 36 giá trị ở đây, tránh
 * lệch tay với backend như level_code từng bị). Nơi gọi hiện dropdown chỉ
 * còn "Tất cả/— chọn —"; form vẫn an toàn vì chỉ gửi province_name khi
 * người dùng đổi.
 *
 * Job cũ có thể mang tỉnh legacy (vd "Bình Dương") không có trong danh
 * sách này — <select> phải tự thêm giá trị hiện tại làm option phụ, xem
 * withCurrentOption() ở lib/utils.ts.
 */
export async function getProvinceNames(): Promise<string[]> {
  try {
    const data = await callPublic<EnumsResponse>("/enums", {
      next: { revalidate: 300 },
    });
    const values = data.province_name ?? [];
    const regular = values
      .filter((v) => !PROVINCES_PINNED_LAST.includes(v))
      .sort((a, b) => a.localeCompare(b, "vi"));
    const pinned = PROVINCES_PINNED_LAST.filter((v) => values.includes(v));
    return [...regular, ...pinned];
  } catch {
    return [];
  }
}
