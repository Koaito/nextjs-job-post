"use client";
// app/(app)/dashboard/recent-jobs-badge.tsx
// Badge "N job" kèm tooltip liệt kê tối đa 5 job mới nhất khi rê chuột/focus
// — tương đương .fit-chip-wrap + .potential-suggestion-tooltip ở
// dashboard.html (Flask). Tooltip dùng @base-ui (components/ui/tooltip),
// mở được cả bằng bàn phím (trigger là <button> focus được — Flask dùng
// tabindex="0" cho mục đích này). Tên job là chuỗi người dùng/crawler
// nhập -> chỉ render bằng text thuần (JSX tự escape).

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const BADGE_CLASS =
  "inline-block whitespace-nowrap rounded-full bg-[var(--brand-teal-soft)] px-[9px] py-[3px] text-[11px] font-semibold text-[var(--brand-teal)]";

export function RecentJobsBadge({ count, jobs }: { count: number; jobs: string[] }) {
  const label = `${count} job`;
  // Không có tên job nào để hiện -> chỉ badge tĩnh, không gắn tooltip rỗng.
  if (jobs.length === 0) return <span className={BADGE_CLASS}>{label}</span>;

  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" className={`${BADGE_CLASS} cursor-help`} />}>{label}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm flex-col items-start gap-1 py-2">
        <strong>Job mới nhất</strong>
        <ul className="list-disc space-y-0.5 pl-4">
          {jobs.map((title, i) => (
            <li key={i}>{title}</li>
          ))}
        </ul>
        <p className="opacity-70">Chỉ hiển thị tối đa 5 job mới nhất của công ty này.</p>
      </TooltipContent>
    </Tooltip>
  );
}
