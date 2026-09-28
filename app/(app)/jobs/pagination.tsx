// app/(app)/jobs/pagination.tsx
// Tương đương _pagination.html bên Flask. Server Component thuần —
// Trước/Sau là <Link>, "Tới trang" là <form method="get"> thường
// (không cần JS, khớp progressive-enhancement của bản Flask).

// Giao diện bám 10-pagination-responsive.css (.pagination, .page-btn,
// .page-status, .page-jump): dải phân cách phía trên, nút viền bo 8px,
// "Trang x / y" font mono, ô "Tới trang" là 1 thẻ viền đẩy sang phải.

import Link from "next/link";

// `.page-btn`
const PAGE_BTN =
  "inline-flex items-center rounded-lg border border-border bg-card px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap text-foreground";
// `.page-btn.is-disabled`
const PAGE_BTN_DISABLED = `${PAGE_BTN} cursor-default bg-[#F5F7F5] text-muted-foreground`;

function buildHref(basePath: string, params: URLSearchParams, page: number) {
  const p = new URLSearchParams(params);
  p.set("page", String(page));
  return `${basePath}?${p.toString()}`;
}

export function Pagination({
  basePath,
  currentParams,
  page,
  totalPages,
}: {
  basePath: string;
  /** Filter hiện tại (đã bỏ "page") — giữ nguyên khi đổi trang. */
  currentParams: URLSearchParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const hiddenFilterEntries = Array.from(currentParams.entries());

  return (
    <nav
      aria-label="Phân trang"
      className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-border pt-[18px]"
    >
      {page > 1 ? (
        <Link
          href={buildHref(basePath, currentParams, page - 1)}
          className={`${PAGE_BTN} hover:border-foreground`}
        >
          ‹ Trước
        </Link>
      ) : (
        <span className={PAGE_BTN_DISABLED}>‹ Trước</span>
      )}

      <span className="font-mono text-[12.5px] text-[var(--brand-ink-soft)]">
        Trang {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={buildHref(basePath, currentParams, page + 1)}
          className={`${PAGE_BTN} hover:border-foreground`}
        >
          Sau ›
        </Link>
      ) : (
        <span className={PAGE_BTN_DISABLED}>Sau ›</span>
      )}

      {/* `.page-jump.filter-bar`: thẻ viền padding 14px, margin-left: auto */}
      <form
        action={basePath}
        method="get"
        className="ml-auto flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card p-3.5"
      >
        {hiddenFilterEntries.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <label
          htmlFor="page-jump-input"
          className="text-[13px] whitespace-nowrap text-[var(--brand-ink-soft)]"
        >
          Tới trang
        </label>
        <input
          id="page-jump-input"
          type="number"
          name="page"
          min={1}
          max={totalPages}
          defaultValue={page}
          inputMode="numeric"
          aria-label="Nhập số trang muốn tới"
          className="w-14 rounded-lg border border-border bg-[#FBFCFB] px-2 py-[7px] text-center text-[13.5px] text-foreground"
        />
        <button
          type="submit"
          className={`${PAGE_BTN} cursor-pointer px-3.5 py-[7px] text-[13px] hover:border-foreground`}
        >
          Tới
        </button>
      </form>
    </nav>
  );
}
