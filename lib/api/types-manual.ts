// lib/api/types-manual.ts
//
// PHÁT HIỆN 22/09 khi rà lại 4 mục "cần rà lại" của checklist: file này
// từng tồn tại (commit 5894742, viết tay tạm thời trước khi có
// types.ts), nhưng đã bị XOÁ khỏi working tree (git status báo
// "deleted", chưa commit) sau khi lib/api/types.ts được generate thật
// bằng openapi-typescript — có vẻ ai đó xoá theo đúng gợi ý trong
// comment cũ của chính file này ("sau khi có types.ts thật, có thể xoá
// file này và import BackendUser trực tiếp từ types.ts"), nhưng lib/
// session.ts, lib/auth-guard.ts, lib/api/auth.ts vẫn đang import từ
// đường dẫn này -> toàn bộ auth layer không compile được. Khôi phục lại
// file, nhưng lần này BackendUser/TokenPair lấy đúng từ types.ts (schema
// thật OpenAPI) thay vì gõ tay lại, theo đúng tinh thần Phần 1 mục 2.5
// của plan (chỉ khác: thêm field `is_staff` — KHÔNG có trong response
// backend, tự tính ở phía Next.js, xem lib/api/auth.ts::getMe()).

import type { components } from "./types";

/**
 * Khớp UserOut (Scrap_JD) + thêm `is_staff` (role !== "user") — field
 * tiện dùng ở auth-guard.ts/UI, backend không trả field này nên PHẢI tự
 * gán khi map response, không tin thẳng `res.json()` là đủ field.
 */
export type BackendUser = components["schemas"]["UserOut"] & {
  is_staff: boolean;
};

/** Khớp TokenPairOut (Scrap_JD) — access_token/refresh_token dùng ở
 *  lib/session.ts, must_change_password ở đây chỉ mang tính tham khảo
 *  lúc login (giá trị đáng tin cậy hơn vẫn là must_change_password đọc
 *  từ getMe() ngay sau đó, vì có thể lệch nếu admin đổi cờ này giữa lúc
 *  access token cũ còn hiệu lực). */
export type TokenPair = components["schemas"]["TokenPairOut"];

/**
 * TẠM THỜI viết tay — `POST /me/saved-jobs/toggle` (Scrap_JD commit
 * fd66308, "Phần 5 mục 9 của plan") chưa có mặt trong lib/api/types.ts
 * vì file đó được generate TRƯỚC khi backend thêm route này. Route
 * thật đã tồn tại và đã chạy được (đọc trực tiếp api/routers/me.py xác
 * nhận), chỉ là generated types chưa theo kịp.
 *
 * XOÁ đoạn này (và đổi lib/api/applications.ts sang import thẳng từ
 * "./types") ngay khi types.ts được generate lại có route này — không
 * cần sửa logic gì ở nơi gọi, chỉ đổi nguồn import.
 */
export interface SavedJobToggleResult {
  saved: boolean;
  /** null khi saved=false (vừa bỏ lưu) — có giá trị khi saved=true (vừa lưu). */
  data: components["schemas"]["SavedJobOut"] | null;
}
