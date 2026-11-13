// lib/api/sources.ts
// GET /sources — danh sách nguồn + category để dựng dropdown "nguồn -> category"
// ở form kích hoạt crawl (Nhóm 6, tab Crawl). Backend lặp qua
// CATEGORIES_BY_SOURCE (scrapjd/sources_registry.py) nên thêm nguồn mới ở
// backend là tự có ở đây — KHÔNG liệt kê cứng nguồn/category ở frontend.
//
// ROUTE PUBLIC: chỉ cần X-API-Key, KHÔNG cần access token -> callPublic(),
// cố ý KHÁC mọi route còn lại của nhóm 6 (đều cần staff). Đừng "cho đồng
// bộ" bằng cách bọc requireStaff()/callAuthed() — plan Nhóm 6 nêu rõ.
//
// OpenAPI chỉ khai response là `unknown` (route dùng response_model=None)
// nên type viết tay ở lib/data-ops/sources.ts, khớp `dict[str, dict[str, str]]`
// của get_sources() trong scrapjd/api/routers/meta.py. Hàm thuần (listCategories...)
// cũng ở đó để Client Component import được.

import { callPublic } from "./client";
import type { SourcesMap } from "@/lib/data-ops/sources";

export type { SourcesMap, SourceCategory } from "@/lib/data-ops/sources";

export async function getSources(): Promise<SourcesMap> {
  // Danh sách chỉ đổi khi backend deploy bản mới -> cache ngắn (5 phút,
  // cùng TTL với /enums) để mở trang /crawl không gọi lại backend mỗi lần.
  return callPublic<SourcesMap>("/sources", { next: { revalidate: 300 } });
}
