// app/(app)/dashboard/bar-row.tsx
// 1 dòng "nhãn — thanh — số" của các thẻ thống kê ở dashboard — tương
// đương .bar-row/.bar-track/.bar-fill (08-dashboard.css, Flask). KHÔNG có
// "use client" cố ý: thuần hiển thị, render được cả ở Server Component
// (các thẻ không phân trang) lẫn trong bar-list.tsx (Client Component).
//
// variant: "accent" (cam, --brand-accent) / "teal" — tương đương
// .bar-fill / .bar-fill-alt bên Flask.

import { cn } from "@/lib/utils";
import { percentOf } from "@/lib/dashboard/overview";

export function BarRow({
  label,
  value,
  total,
  variant = "accent",
}: {
  label: string;
  value: number;
  /** Mẫu số để tính % độ rộng thanh (vd tổng job). */
  total: number;
  variant?: "accent" | "teal";
}) {
  return (
    <div className="mb-[9px] grid grid-cols-[130px_1fr_auto] items-center gap-2.5 text-[12.5px]">
      <span className="truncate text-[var(--brand-ink-soft)]" title={label}>
        {label}
      </span>
      <div className="h-[9px] overflow-hidden rounded-full bg-[#EFF2F0]">
        <div
          className={cn("h-full rounded-full", variant === "accent" ? "bg-primary" : "bg-[var(--brand-teal)]")}
          style={{ width: `${percentOf(value, total)}%` }}
        />
      </div>
      <span className="min-w-7 text-right font-mono text-muted-foreground">{value}</span>
    </div>
  );
}
