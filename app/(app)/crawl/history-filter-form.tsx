// app/(app)/crawl/history-filter-form.tsx
// Form lọc (method GET, không cần JS) của MỘT bảng lịch sử. Giữ nguyên query của BẢNG KIA qua input ẩn và KHÔNG
// gửi trang của bảng này, nên đổi lọc reset đúng trang của bảng này, bảng kia giữ nguyên lọc và trang.

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RUN_STATUS_LABELS } from "@/lib/data-ops/crawl-ui";
import { RUN_STATUS_FILTERS } from "@/lib/data-ops/crawl-history";

const SELECT = "rounded-md border bg-background px-2 py-1.5 text-sm";

export interface FilterOption {
  value: string;
  label: string;
}

export function HistoryFilterForm({
  label,
  /** Tên và giá trị các lọc riêng của bảng (nguồn hoặc job_type), đã validate. */
  primary,
  statusName,
  status,
  /** Query của BẢNG KIA cần giữ nguyên (đã loại trang của bảng này). */
  preserved,
  clearHref,
  hasFilter,
}: {
  label: string;
  primary: { name: string; label: string; value: string; options: FilterOption[] } | null;
  statusName: string;
  status: string;
  preserved: Array<[string, string]>;
  clearHref: string;
  hasFilter: boolean;
}) {
  return (
    <form method="get" action="/crawl" aria-label={`Lọc ${label}`} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tab" value="history" />
      {preserved.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {primary ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {primary.label}
          <select name={primary.name} defaultValue={primary.value} className={SELECT}>
            <option value="">Tất cả</option>
            {primary.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Trạng thái
        <select name={statusName} defaultValue={status} className={SELECT}>
          <option value="">Tất cả</option>
          {RUN_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {RUN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm">
        Lọc
      </Button>
      {hasFilter ? (
        <Link href={clearHref} className="py-1.5 text-sm text-muted-foreground underline">
          Xoá lọc
        </Link>
      ) : null}
    </form>
  );
}
