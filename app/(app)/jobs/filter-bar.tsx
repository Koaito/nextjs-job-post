"use client";
// app/(app)/jobs/filter-bar.tsx
//
// Search-as-you-type (plan Nhóm 1, dòng 969): input q debounce ~300ms
// -> router.replace() (KHÔNG router.push(), tránh mỗi ký tự gõ thêm 1
// history entry — bấm Back sẽ phải lùi qua từng ký tự) -> Server
// Component (page.tsx) tự fetch lại. Dropdown (industry/level/
// location/status) áp dụng NGAY khi chọn, không debounce — chỉ input
// tự do (q) mới cần debounce.
//
// Đổi BẤT KỲ filter nào cũng xoá param "page" -> luôn về trang 1, vì
// trang hiện tại có thể không còn hợp lệ với bộ lọc mới (tổng số kết
// quả đổi khác).

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { INDUSTRIES, JOB_LOCATIONS, JOB_STATUS_LABELS } from "@/lib/constants";

const DEBOUNCE_MS = 300;

export function JobFilterBar({ levels }: { levels: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const industry = searchParams.get("industry") ?? "";
  const level = searchParams.get("level") ?? "";
  const location = searchParams.get("location") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParams(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value }), DEBOUNCE_MS);
  }

  const hasActiveFilter = q || industry || level || location || status;

  function clearAll() {
    setQ("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Tìm theo vị trí, công ty, kỹ năng…"
        value={q}
        onChange={(e) => handleQChange(e.target.value)}
        className="min-w-[220px] flex-1 rounded-md border px-3 py-2 text-sm"
      />

      <select
        value={industry}
        onChange={(e) => updateParams({ industry: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Tất cả ngành</option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>

      <select
        value={level}
        onChange={(e) => updateParams({ level: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Mọi level</option>
        {levels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <select
        value={location}
        onChange={(e) => updateParams({ location: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Mọi địa điểm</option>
        {JOB_LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        {/* value="" = mặc định "Đang tuyển" (xem lib/api/jobs.ts), KHÔNG
            phải "mọi trạng thái" — khớp đúng _index_filters() bên Flask. */}
        <option value="">{JOB_STATUS_LABELS.OPEN}</option>
        <option value={JOB_STATUS_LABELS.CLOSED}>{JOB_STATUS_LABELS.CLOSED}</option>
        <option value="ALL">Tất cả trạng thái</option>
      </select>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md px-3 py-2 text-sm underline"
        >
          Xóa lọc
        </button>
      )}
    </div>
  );
}
