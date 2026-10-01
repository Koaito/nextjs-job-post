"use client";
// app/(app)/activity-logs/company-filter-combobox.tsx
// Ô chọn công ty gõ-để-lọc cho bộ lọc /activity-logs (Nhóm 3, Đợt 3.4,
// Phần 2/5), xây trên components/ui/command.tsx (cmdk). Thay <select> liệt
// kê TOÀN BỘ công ty của Flask — với 1.200+ (plan: 5.000-7.000) công ty thì
// <select> thường không dùng nổi.
//
// Lọc ở SERVER (cmdk shouldFilter={false}): mỗi lần gõ, debounce 300ms rồi
// gọi GET /api/companies/search?q=, tối đa 50 kết quả. Request cũ bị huỷ
// bằng AbortController khi có lần gõ mới (plan Nhóm 3: không để response cũ
// về sau ghi đè kết quả mới). Chạm trần 50 thì có dòng nhắc gõ thêm.
//
// Giá trị chọn nằm trong <input type="hidden" name="company_id"> — component
// này nằm trong <form method="get"> của bộ lọc, submit bằng nút "Lọc".

import { useEffect, useRef, useState } from "react";
import { Command, CommandEmpty, CommandItem, CommandList, CommandInput } from "@/components/ui/command";

const DEBOUNCE_MS = 300;

interface CompanyHit {
  id: string;
  name: string;
}

export function CompanyFilterCombobox({
  initialId,
  initialName,
}: {
  initialId: string;
  /** Tên công ty đang lọc (page tải sẵn); rỗng nếu không tải được. */
  initialName: string;
}) {
  const [selected, setSelected] = useState<CompanyHit>({ id: initialId, name: initialName });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CompanyHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Tải kết quả khi mở ô / khi gõ. Lần mở đầu (query rỗng) gọi ngay, các
  // lần gõ sau debounce.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(`/api/companies/search?q=${encodeURIComponent(query.trim())}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { items: CompanyHit[]; total: number };
          setItems(data.items);
          setTotal(data.total);
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") return;
          setError("Không tải được danh sách công ty.");
          setItems([]);
          setTotal(0);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query.trim() ? DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  function choose(hit: CompanyHit) {
    setSelected(hit);
    setOpen(false);
    setQuery("");
  }

  // Có company_id nhưng chưa lấy được tên (getCompany lỗi) -> vẫn báo đang
  // lọc, không giả vờ là "Mọi công ty".
  const label = selected.id ? selected.name || "Công ty đã chọn" : "Mọi công ty";

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        // Enter trong ô tìm không được submit cả form lọc.
        if (e.key === "Enter") e.preventDefault();
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <input type="hidden" name="company_id" value={selected.id} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-60 truncate rounded-md border bg-background px-3 py-2 text-left text-sm"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false} className="rounded-md!">
            <CommandInput value={query} onValueChange={setQuery} placeholder="Gõ tên công ty…" autoFocus />
            <CommandList>
              <CommandItem value="__all__" onSelect={() => choose({ id: "", name: "" })}>
                Mọi công ty
              </CommandItem>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  data-checked={c.id === selected.id}
                  onSelect={() => choose(c)}
                >
                  {c.name}
                </CommandItem>
              ))}
              {!loading && !error && items.length === 0 && <CommandEmpty>Không tìm thấy công ty nào.</CommandEmpty>}
              {loading && <p className="px-3 py-2 text-xs text-muted-foreground">Đang tìm…</p>}
              {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
              {!loading && !error && total > items.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Hiển thị {items.length} kết quả đầu trong {total} — gõ thêm để thu hẹp.
                </p>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
