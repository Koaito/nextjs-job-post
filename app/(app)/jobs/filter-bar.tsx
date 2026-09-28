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
import { INDUSTRIES, JOB_STATUS_LABELS } from "@/lib/constants";
import { withCurrentOption } from "@/lib/utils";

const DEBOUNCE_MS = 300;

// `.filter-bar input, .filter-bar select` (03-layout.css): padding 9px 11px,
// bo 8px, viền --border, nền #FBFCFB, chữ 13.5px.
const CONTROL_CLASS =
  "rounded-lg border border-border bg-[#FBFCFB] px-[11px] py-[9px] text-[13.5px] text-foreground";

// `provinces` lấy từ GET /enums (lib/api/enums.ts::getProvinceNames) — backend
// lọc `province` khớp TUYỆT ĐỐI với tên trong bảng provinces, nên dropdown
// chỉ được chứa đúng tên backend biết (trước đây có "TP.HCM"/"Hybrid" tự
// đặt -> luôn ra 0 job).
export function JobFilterBar({ levels, provinces }: { levels: string[]; provinces: string[] }) {
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
    // `.filter-bar`: thẻ trắng có viền, gap 10px, padding 14px, mb 10px.
    // Flask có thêm nút "Lọc" (submit form) — bỏ có chủ đích vì đây là
    // search-as-you-type, dropdown áp dụng ngay (plan dòng 969).
    <div className="mb-2.5 flex flex-wrap gap-2.5 rounded-[var(--radius)] border border-border bg-card p-3.5">
      <input
        type="text"
        placeholder="Tìm theo vị trí, công ty, kỹ năng…"
        value={q}
        onChange={(e) => handleQChange(e.target.value)}
        className={`min-w-0 flex-[1_1_220px] ${CONTROL_CLASS}`}
      />

      <select
        value={industry}
        onChange={(e) => updateParams({ industry: e.target.value })}
        className={CONTROL_CLASS}
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
        className={CONTROL_CLASS}
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
        className={CONTROL_CLASS}
      >
        <option value="">Mọi địa điểm</option>
        {/* URL cũ/bookmark có location không còn hợp lệ vẫn hiện được ở đây
            thay vì <select> lặng lẽ hiện "Mọi địa điểm" trong khi vẫn đang lọc. */}
        {withCurrentOption(provinces, location).map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value })}
        className={CONTROL_CLASS}
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
          className="inline-block cursor-pointer px-1.5 py-2.5 text-sm font-semibold whitespace-nowrap text-[var(--brand-ink-soft)] hover:text-primary"
        >
          Xóa lọc
        </button>
      )}
    </div>
  );
}
