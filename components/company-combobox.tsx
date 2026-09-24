"use client";
// components/company-combobox.tsx
// Khớp đoạn plan Nhóm 1: "<CompanyCombobox> ở form tạo job có 2 chế
// độ, không chỉ đơn thuần 1 dropdown chọn công ty có sẵn: gõ để lọc
// trong danh sách công ty đã có, hoặc chọn dòng '＋ Tạo công ty
// mới…' (pin cố định cuối danh sách, không bị lọc mất khi gõ) để lộ
// thêm 1 nhóm field nhập tay (tên, mã số thuế, website, lĩnh vực,
// thành phố) ngay trong form."
//
// Component THUẦN presentational, KHÔNG tự fetch companies — nhận
// `companies` qua prop. Lý do: plan yêu cầu "chỉ gọi API đúng 1 lần,
// dùng lại cho cả tab job lẫn tab contact" ở /them-moi (context
// builder chung, xem add_hub.html trong plan) — nếu component tự
// fetch, mỗi lần dùng lại ở 1 tab khác sẽ tự gọi API riêng, lệch đúng
// điều plan cố tránh. Nơi gọi (JobForm ở Nhóm 1 phần sau, ContactForm
// ở Nhóm 2) tự lo việc load `companies` 1 lần rồi truyền xuống.
//
// KHÔNG tự gọi POST /companies ở đây — component chỉ thu thập dữ liệu
// (mode + field), việc thật sự gọi API tạo công ty (và xử lý idempotent
// theo tax_id/tên, hiện thông báo "đã tìm thấy công ty trùng"...) do
// server action của FORM CHA quyết định lúc submit, xem
// lib/api/companies.ts::createCompany().

import { useEffect, useRef, useState } from "react";
import { CITIES_VN, INDUSTRIES } from "@/lib/constants";
import type { CompanyOption } from "@/lib/api/companies";

export type CompanyFieldValue =
  | { mode: "existing"; companyId: string }
  | {
      mode: "new";
      companyName: string;
      taxId: string;
      website: string;
      industry: string;
      city: string;
    };

export function newCompanyFieldValue(): CompanyFieldValue {
  return { mode: "new", companyName: "", taxId: "", website: "", industry: "", city: "" };
}

const MAX_VISIBLE_RESULTS = 50;

export function CompanyCombobox({
  companies,
  value,
  onChange,
  disabled = false,
}: {
  companies: CompanyOption[];
  value: CompanyFieldValue;
  onChange: (value: CompanyFieldValue) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedExisting =
    value.mode === "existing" ? companies.find((c) => c.id === value.companyId) : undefined;

  const filtered = query.trim()
    ? companies.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : companies;
  const visible = filtered.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenCount = filtered.length - visible.length;

  function selectCompany(c: CompanyOption) {
    onChange({ mode: "existing", companyId: c.id });
    setQuery("");
    setOpen(false);
  }

  function startCreateNew() {
    onChange(newCompanyFieldValue());
    setQuery("");
    setOpen(false);
  }

  function backToSearch() {
    // Về chế độ tìm — KHÔNG giữ lại dữ liệu đã gõ ở nhóm field tạo mới
    // (quyết định có chủ đích để giữ component đơn giản: quay lại tìm
    // rồi lại bấm "Tạo công ty mới…" thì nhập lại từ đầu, không cố
    // khôi phục form dở dang).
    onChange({ mode: "existing", companyId: "" });
  }

  if (value.mode === "new") {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tạo công ty mới</span>
          <button
            type="button"
            onClick={backToSearch}
            disabled={disabled}
            className="text-sm text-muted-foreground underline"
          >
            ← Chọn công ty có sẵn
          </button>
        </div>

        <div>
          <label htmlFor="cc-company-name" className="mb-1 block text-sm font-medium">
            Tên công ty <span className="text-destructive">*</span>
          </label>
          <input
            id="cc-company-name"
            required
            disabled={disabled}
            value={value.companyName}
            onChange={(e) => onChange({ ...value, companyName: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cc-tax-id" className="mb-1 block text-sm font-medium">
              Mã số thuế
            </label>
            <input
              id="cc-tax-id"
              disabled={disabled}
              value={value.taxId}
              onChange={(e) => onChange({ ...value, taxId: e.target.value })}
              placeholder="Để trống nếu chưa rõ"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cc-website" className="mb-1 block text-sm font-medium">
              Website
            </label>
            <input
              id="cc-website"
              disabled={disabled}
              value={value.website}
              onChange={(e) => onChange({ ...value, website: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cc-industry" className="mb-1 block text-sm font-medium">
              Lĩnh vực
            </label>
            <select
              id="cc-industry"
              disabled={disabled}
              value={value.industry}
              onChange={(e) => onChange({ ...value, industry: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Chưa rõ —</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cc-city" className="mb-1 block text-sm font-medium">
              Thành phố
            </label>
            <select
              id="cc-city"
              disabled={disabled}
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Chưa rõ —</option>
              {CITIES_VN.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        value={open ? query : (selectedExisting?.name ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        placeholder="Gõ để tìm công ty đã có…"
        role="combobox"
        aria-expanded={open}
        aria-controls="cc-listbox"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />

      {open && (
        <ul
          id="cc-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md"
        >
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={value.mode === "existing" && value.companyId === c.id}
                onClick={() => selectCompany(c)}
                className="block w-full px-3 py-2 text-left hover:bg-muted"
              >
                {c.name}
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">Không tìm thấy công ty nào.</li>
          )}
          {hiddenCount > 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Còn {hiddenCount} kết quả khác — gõ thêm để lọc chính xác hơn.
            </li>
          )}
          {/* Pin cố định — LUÔN hiện, không bị lọc mất khi gõ (đúng plan) */}
          <li className="border-t">
            <button
              type="button"
              onClick={startCreateNew}
              className="block w-full px-3 py-2 text-left font-medium text-primary hover:bg-muted"
            >
              ＋ Tạo công ty mới…
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
