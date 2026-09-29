"use client";
// app/(app)/dashboard/followup-days-select.tsx
// Ô chọn "Im lặng từ [7|14|30] ngày" của khối "Contact cần follow-up" —
// tương đương <form method="get"> + <select onchange="this.form.submit()">
// ở dashboard.html (Flask). Chỉ 3 lựa chọn cố định (lib/dashboard/
// companies.ts), KHÔNG phải input số.
//
// Đổi giá trị = router.replace() tới `?tab=doanh-nghiep&followup_days=N`
// (replace, không push — cùng lý do với thanh tab: không tạo thêm history
// entry). Server (page.tsx) đọc lại + validate whitelist rồi mới gọi API.
// useOptimistic + transition: ô chọn đổi ngay, không đợi server trả bảng mới.
// Không dùng <form> submit như Flask nên không reload cả trang.

import { useId, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FOLLOWUP_DAYS_OPTIONS, parseFollowupDays, type FollowupDays } from "@/lib/dashboard/companies";

export function FollowupDaysSelect({ value }: { value: FollowupDays }) {
  const id = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  function onChange(raw: string) {
    const next = parseFollowupDays(raw);
    if (next === optimisticValue) return;
    startTransition(() => {
      setOptimisticValue(next);
      router.replace(`/dashboard?tab=doanh-nghiep&followup_days=${next}`, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-1.5 text-[13px]" aria-busy={isPending}>
      <label htmlFor={id} className="text-muted-foreground">
        Im lặng từ
      </label>
      <select
        id={id}
        value={optimisticValue}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-[13px]"
      >
        {FOLLOWUP_DAYS_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d} ngày
          </option>
        ))}
      </select>
    </div>
  );
}
