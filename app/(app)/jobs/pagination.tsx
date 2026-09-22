// app/(app)/jobs/pagination.tsx
// Tương đương _pagination.html bên Flask. Server Component thuần —
// Trước/Sau là <Link>, "Tới trang" là <form method="get"> thường
// (không cần JS, khớp progressive-enhancement của bản Flask).

import Link from "next/link";

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
    <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={buildHref(basePath, currentParams, page - 1)} className="underline">
          ‹ Trước
        </Link>
      ) : (
        <span className="text-muted-foreground">‹ Trước</span>
      )}

      <span>
        Trang {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={buildHref(basePath, currentParams, page + 1)} className="underline">
          Sau ›
        </Link>
      ) : (
        <span className="text-muted-foreground">Sau ›</span>
      )}

      <form action={basePath} method="get" className="flex items-center gap-2">
        {hiddenFilterEntries.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <label htmlFor="page-jump-input" className="text-muted-foreground">
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
          className="w-16 rounded-md border px-2 py-1"
        />
        <button type="submit" className="rounded-md border px-2 py-1">
          Tới
        </button>
      </form>
    </nav>
  );
}
