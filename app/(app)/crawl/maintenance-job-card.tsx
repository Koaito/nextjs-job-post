"use client";
// app/(app)/crawl/maintenance-job-card.tsx
// MỘT thẻ job bảo trì: mô tả, form chạy (CHỈ admin), trạng thái + kết quả của lượt gần nhất và ô log. Mỗi job một
// shape `stats` khác nhau nên ô số liệu do maintenanceResultTiles chọn theo job_type; form theo quy tắc của
// lib/data-ops/maintenance.ts (job tốn phí bắt buộc limit; dry_run/check_deadline_only chỉ job hỗ trợ), không hard-code
// tên job ở đây.
// Nút tắt khi ĐANG GỬI hoặc job đang chạy (backend cũng chặn 409, nhưng bấm trùng là tốn một lượt trong hạn mức 10/giờ).
// Không tắt sớm ở nhánh báo lỗi, để sửa lại bấm được ngay.

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  MAINTENANCE_LIMIT_MAX,
  MAINTENANCE_LIMIT_MIN,
  isMaintenanceRunActive,
  maintenanceRequiresLimit,
  maintenanceSupportsDryRun,
  type AnyMaintenanceRun,
  type MaintenanceJobType,
  type MaintenanceLogLine,
} from "@/lib/data-ops/maintenance";
import { MaintenanceClientError, startMaintenanceRun } from "@/lib/data-ops/maintenance-client";
import { validateMaintenanceForm, type MaintenanceFormErrors } from "@/lib/data-ops/maintenance-form";
import {
  MAINTENANCE_JOB_DESCRIPTIONS,
  isCostlyMaintenanceJob,
  maintenanceResultNotes,
  maintenanceResultTiles,
} from "@/lib/data-ops/maintenance-live";
import { formatDuration, maintenanceJobLabel, maintenanceParamsSummary } from "@/lib/data-ops/crawl-ui";
import { formatShortDateTimeVN } from "@/lib/date";
import { LogBox } from "./log-box";
import { RunStatusBadge } from "./run-status-badge";

const FIELD = "rounded-md border bg-background px-2 py-1.5 text-sm";
const ERR = "text-xs text-red-700 dark:text-red-300";

function TriggerForm({
  jobType,
  busy,
  onStarted,
}: {
  jobType: MaintenanceJobType;
  /** Job đang có lượt chạy dở: không cho bấm thêm. */
  busy: boolean;
  onStarted: () => void;
}) {
  const label = maintenanceJobLabel(jobType);
  const requiresLimit = maintenanceRequiresLimit(jobType);
  const supportsDry = maintenanceSupportsDryRun(jobType);

  const [limitText, setLimitText] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [checkDeadlineOnly, setCheckDeadlineOnly] = useState(false);
  const [errors, setErrors] = useState<MaintenanceFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting || busy) return;
    setServerError(null);
    const result = validateMaintenanceForm({ jobType, limitText, dryRun, checkDeadlineOnly });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await startMaintenanceRun(jobType, result.request);
      onStarted();
    } catch (err) {
      setServerError(err instanceof MaintenanceClientError ? err.message : "Không chạy được job. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={`Chạy ${label}`} className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {requiresLimit ? "Giới hạn (bắt buộc)" : "Giới hạn"}
          <input
            name="limit"
            inputMode="numeric"
            value={limitText}
            onChange={(e) => setLimitText(e.target.value)}
            placeholder={requiresLimit ? "Số công ty tối đa" : "Chạy hết"}
            className={`${FIELD} w-40`}
            aria-invalid={errors.limit ? true : undefined}
            aria-required={requiresLimit || undefined}
          />
          <span className="text-xs text-muted-foreground">
            {MAINTENANCE_LIMIT_MIN} đến {MAINTENANCE_LIMIT_MAX}
          </span>
          {errors.limit ? <span className={ERR}>{errors.limit}</span> : null}
        </label>

        {supportsDry ? (
          <fieldset className="space-y-1 text-sm">
            <legend className="sr-only">Tuỳ chọn kiểm tra</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="dry_run" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Chạy thử (không ghi)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="check_deadline_only"
                checked={checkDeadlineOnly}
                onChange={(e) => setCheckDeadlineOnly(e.target.checked)}
              />
              Chỉ kiểm hạn (không truy cập nguồn)
            </label>
          </fieldset>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting || busy}>
          {submitting ? "Đang gửi…" : "Chạy"}
        </Button>
        {busy ? <span className="text-xs text-muted-foreground">Job này đang chạy, đợi xong mới chạy lại được.</span> : null}
      </div>
    </form>
  );
}

function RunSummary({ run }: { run: AnyMaintenanceRun }) {
  const live = isMaintenanceRunActive(run.status);
  const tiles = live ? [] : maintenanceResultTiles(run);
  const notes = live ? [] : maintenanceResultNotes(run);
  const duration = live ? null : formatDuration(run.started_at, run.finished_at);
  const params = maintenanceParamsSummary(run.params);

  return (
    <div className="space-y-3" data-testid="maintenance-run" data-run-id={run.run_id}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <RunStatusBadge status={run.status} />
        <span className="text-muted-foreground">
          bắt đầu {formatShortDateTimeVN(run.started_at)}
          {duration ? ` · ${duration}` : ""}
          {run.triggered_by_name ? ` · ${run.triggered_by_name}` : ""}
          {params ? ` · ${params}` : ""}
        </span>
      </div>

      {run.status === "error" && run.error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {run.error}
        </p>
      ) : null}

      {notes.map((n) => (
        <p key={n} role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {n}
        </p>
      ))}

      {tiles.length > 0 ? (
        <dl data-testid="maintenance-result" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.key} className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="font-mono text-lg font-semibold">{t.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function MaintenanceJobCard({
  jobType,
  run,
  isAdmin,
  logLines,
  onStarted,
}: {
  jobType: MaintenanceJobType;
  run: AnyMaintenanceRun | null;
  isAdmin: boolean;
  /** Dòng log đã gộp của lượt này; null = chưa tải lần nào. */
  logLines: MaintenanceLogLine[] | null;
  onStarted: () => void;
}) {
  const label = maintenanceJobLabel(jobType);
  const live = run ? isMaintenanceRunActive(run.status) : false;

  return (
    <article
      aria-label={label}
      data-testid="maintenance-card"
      data-job-type={jobType}
      className="space-y-4 rounded-md border p-4"
    >
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{label}</h2>
          {isCostlyMaintenanceJob(jobType) ? (
            <span
              data-testid="maintenance-costly"
              className="rounded-full bg-amber-100 px-2 py-[2px] text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              Tốn phí thật
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{MAINTENANCE_JOB_DESCRIPTIONS[jobType]}</p>
      </header>

      {isAdmin ? <TriggerForm jobType={jobType} busy={live} onStarted={onStarted} /> : null}

      {run ? (
        <RunSummary run={run} />
      ) : (
        <p data-testid="maintenance-never-run" className="text-sm text-muted-foreground">
          Job này chưa từng chạy.
        </p>
      )}

      {run ? (
        <section aria-label={`Log live: ${label}`} className="space-y-2">
          <h3 className="text-sm font-semibold">Log live</h3>
          <LogBox
            lines={logLines ?? []}
            testId="maintenance-log"
            label={`Log ${label}`}
            heightClass="h-44"
            emptyText={
              logLines === null ? "Đang tải log…" : live ? "Đang chờ log đầu tiên…" : "Lượt này chưa có log."
            }
          />
        </section>
      ) : null}
    </article>
  );
}
