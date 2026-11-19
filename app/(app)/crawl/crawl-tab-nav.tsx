// app/(app)/crawl/crawl-tab-nav.tsx
// Thanh 4 tab của /crawl. Mỗi tab là <Link> điều hướng THẬT (?tab=): server chỉ dựng nội dung của đúng tab
// đang mở, nên polling của tab ẩn không thể chạy ngầm; còn dùng được khi JS lỗi, và deep-link được.
// Cố ý không giữ query của tab cũ khi đổi tab (mỗi tab có bộ query riêng).

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CRAWL_TAB_IDS, CRAWL_TAB_LABELS, crawlTabHref, type CrawlTabId } from "@/lib/data-ops/crawl-tabs";

export function CrawlTabNav({ active }: { active: CrawlTabId }) {
  return (
    <nav aria-label="Các mục vận hành dữ liệu" className="flex flex-wrap gap-1 border-b">
      {CRAWL_TAB_IDS.map((id) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={crawlTabHref(id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {CRAWL_TAB_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}
