"use client";
// app/(app)/companies/filter-bar.tsx
// Cùng pattern app/(app)/jobs/filter-bar.tsx (Nhóm 1) — search-as-you-type
// debounce cho q, dropdown áp dụng ngay. Khác jobs/filter-bar.tsx ở chỗ
// dropdown "Tỉnh/Thành" dùng CITIES_VN TĨNH (34 tỉnh sau sáp nhập, khớp
// bảng provinces) + "Khác" — không gọi round-trip list_company_cities()
// như Flask, nên có thể hiện tỉnh 0 kết quả nhưng KHÔNG còn tên nào lệch
// với DB (lỗi cũ: list 63 tên khiến "TP. Hồ Chí Minh" luôn ra 0 công ty).

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CITIES_VN, CITY_OTHER } from "@/lib/constants";
import { withCurrentOption } from "@/lib/utils";

const DEBOUNCE_MS = 300;

export function CompanyFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const city = searchParams.get("city") ?? "";

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

  const hasActiveFilter = q || city;

  function clearAll() {
    setQ("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Tìm theo tên công ty, mã số thuế…"
        value={q}
        onChange={(e) => handleQChange(e.target.value)}
        className="min-w-[220px] flex-1 rounded-md border px-3 py-2 text-sm"
      />

      <select
        value={city}
        onChange={(e) => updateParams({ city: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Mọi tỉnh/thành</option>
        {withCurrentOption([...CITIES_VN, CITY_OTHER], city).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {hasActiveFilter && (
        <button type="button" onClick={clearAll} className="rounded-md px-3 py-2 text-sm underline">
          Xóa lọc
        </button>
      )}
    </div>
  );
}
