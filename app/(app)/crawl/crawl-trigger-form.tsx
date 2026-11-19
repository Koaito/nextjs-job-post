"use client";
// app/(app)/crawl/crawl-trigger-form.tsx
// Form chạy crawl (CHỈ admin thấy). Luôn đi qua POST /crawl/batch kể cả khi tick một category. Nguồn -> category lấy từ
// GET /sources (không liệt kê cứng). Kiểm tra ngay trên form bằng validateCrawlForm (cùng bộ giới hạn với route).
// Nút chỉ tắt khi ĐANG GỬI — không tắt sớm ở nhánh báo lỗi, để sửa lại bấm được ngay.

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CRAWL_MAX_JOBS_MAX, CRAWL_PAGES_MAX } from "@/lib/data-ops/crawl";
import { CrawlClientError, startCrawlBatch, type CrawlBatchStarted } from "@/lib/data-ops/crawl-client";
import { validateCrawlForm, type CrawlFormErrors } from "@/lib/data-ops/crawl-form";
import { listCategories, listSourceNames, type SourcesMap } from "@/lib/data-ops/sources";

const FIELD = "rounded-md border bg-background px-2 py-1.5 text-sm";
const ERR = "text-xs text-red-700 dark:text-red-300";

export function CrawlTriggerForm({
  sources,
  onStarted,
}: {
  sources: SourcesMap;
  onStarted: (started: CrawlBatchStarted) => void;
}) {
  const names = listSourceNames(sources);
  const [source, setSource] = useState(names[0] ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [pagesText, setPagesText] = useState("");
  const [maxJobsText, setMaxJobsText] = useState("");
  const [errors, setErrors] = useState<CrawlFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categories = listCategories(sources, source);

  function changeSource(next: string) {
    setSource(next);
    setSelected([]); // category của nguồn cũ không còn hợp lệ ở nguồn mới
    setErrors({});
    setServerError(null);
  }

  function toggle(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setServerError(null);
    // Thứ tự gửi = thứ tự hiển thị trong danh sách (backend crawl tuần tự đúng thứ tự này), không theo thứ tự tick.
    const ordered = categories.map((c) => c.key).filter((k) => selected.includes(k));
    const result = validateCrawlForm({ source, categories: ordered, pagesText, maxJobsText });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const started = await startCrawlBatch(result.request);
      setSelected([]);
      onStarted(started);
    } catch (err) {
      setServerError(err instanceof CrawlClientError ? err.message : "Không chạy được crawl. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Chạy crawl" className="space-y-4 rounded-md border p-4">
      <h2 className="font-heading text-lg font-semibold">Chạy crawl</h2>

      <div className="flex flex-wrap items-start gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nguồn
          <select
            name="source"
            value={source}
            onChange={(e) => changeSource(e.target.value)}
            className={FIELD}
            aria-invalid={errors.source ? true : undefined}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.source ? <span className={ERR}>{errors.source}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Số trang
          <input
            name="pages"
            inputMode="numeric"
            value={pagesText}
            onChange={(e) => setPagesText(e.target.value)}
            placeholder="Mặc định"
            className={`${FIELD} w-28`}
            aria-invalid={errors.pages ? true : undefined}
          />
          <span className="text-xs text-muted-foreground">1 đến {CRAWL_PAGES_MAX}</span>
          {errors.pages ? <span className={ERR}>{errors.pages}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Số tin tối đa
          <input
            name="max_jobs"
            inputMode="numeric"
            value={maxJobsText}
            onChange={(e) => setMaxJobsText(e.target.value)}
            placeholder="Không giới hạn"
            className={`${FIELD} w-36`}
            aria-invalid={errors.maxJobs ? true : undefined}
          />
          <span className="text-xs text-muted-foreground">1 đến {CRAWL_MAX_JOBS_MAX}</span>
          {errors.maxJobs ? <span className={ERR}>{errors.maxJobs}</span> : null}
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 flex items-center gap-3 text-sm">
          <span>Category (crawl tuần tự theo thứ tự hiển thị)</span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setSelected(categories.map((c) => c.key))}
          >
            Chọn tất cả
          </button>
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSelected([])}>
            Bỏ chọn
          </button>
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {categories.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} value={c.key} />
              {c.label}
            </label>
          ))}
        </div>
        {errors.categories ? <p className={ERR}>{errors.categories}</p> : null}
      </fieldset>

      {serverError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang gửi…" : "Chạy crawl"}
      </Button>
    </form>
  );
}
