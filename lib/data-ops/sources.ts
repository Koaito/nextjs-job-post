// lib/data-ops/sources.ts
// Phần THUẦN (không gọi mạng, không import server-only) của GET /sources — dùng
// được ở cả Client Component (dropdown nguồn -> category ở form crawl). Lời gọi
// thật nằm ở lib/api/sources.ts.

/** { [source]: { [category_key]: label tiếng Việt } } — vd
 *  { topcv: { "data-analyst": "Data Analyst" }, vietnamworks: {...} }. */
export type SourcesMap = Record<string, Record<string, string>>;

/** Một category của 1 nguồn, dạng mảng để render dropdown/checklist. */
export interface SourceCategory {
  key: string;
  label: string;
}

/** Tên nguồn theo thứ tự backend trả về (thứ tự đăng ký trong registry). */
export function listSourceNames(sources: SourcesMap): string[] {
  return Object.keys(sources);
}

/** Category của 1 nguồn, theo thứ tự backend; nguồn không tồn tại -> []. */
export function listCategories(sources: SourcesMap, source: string): SourceCategory[] {
  const cats = sources[source];
  if (!cats) return [];
  return Object.entries(cats).map(([key, label]) => ({ key, label }));
}
