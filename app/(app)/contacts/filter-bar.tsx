"use client";
// app/(app)/contacts/filter-bar.tsx
// Cùng pattern companies/filter-bar.tsx + jobs/filter-bar.tsx — q debounce
// 300ms, 2 dropdown áp dụng ngay (thay nút "Lọc" của Flask, plan Nhóm 1:
// search-as-you-type). Thay đổi bộ lọc luôn xoá ?notice (thông báo 1 lần
// sau redirect) để không hiện lại thông báo cũ.
//
// value của dropdown "Trạng thái" là MÃ backend (UNCONTACTED...), không
// phải nhãn Việt như Flask — xem CONTACT_STATUS_CODES ở lib/constants.ts.

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CONTACT_STATUS_CODES, CONTACT_STATUS_LABELS } from "@/lib/constants";

const DEBOUNCE_MS = 300;

export interface CompanyFilterOption {
  id: string;
  name: string;
}

export function ContactFilterBar({ companies }: { companies: CompanyFilterOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyId = searchParams.get("company_id") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParams(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("notice");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value }), DEBOUNCE_MS);
  }

  function clearAll() {
    setQ("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilter = q || companyId || status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Tìm theo tên contact…"
        value={q}
        onChange={(e) => handleQChange(e.target.value)}
        className="min-w-[220px] flex-1 rounded-md border px-3 py-2 text-sm"
      />

      <select
        value={companyId}
        onChange={(e) => updateParams({ company_id: e.target.value })}
        className="max-w-[240px] rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Mọi công ty</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Mọi trạng thái</option>
        {CONTACT_STATUS_CODES.map((code) => (
          <option key={code} value={code}>
            {CONTACT_STATUS_LABELS[code] ?? code}
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
