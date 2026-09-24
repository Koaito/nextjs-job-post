"use client";
// components/job-form.tsx
// Tương đương _job_form.html (dùng chung add_job.html + tab "job" của
// add_hub.html) — Nhóm 1, phần 3b của plan. <JobForm> dùng chung cho cả
// tạo (mode="create") và sửa (mode="edit"), giữ đúng 2 quy tắc plan đã
// nhấn mạnh:
//   1. Luôn có field "Chu kỳ trả lương" (Tháng/Năm), mặc định "Tháng"
//      khi tạo mới (xem emptyJobFormValues()).
//   2. Ô chọn công ty CHỈ hiện ở mode="create" — PATCH /jobs/{id} không
//      nhận company_id nên không có cách nào đổi company của job đã có.
//
// mode="create" ở ROUND NÀY CHƯA có trang nào gọi tới (chưa có /them-moi,
// xem quyết định round 3 — "giữ /jobs/add tới round 4"), viết sẵn để
// Round 4 chỉ việc render <JobForm mode="create" .../> mà không phải
// sửa lại component này.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CompanyCombobox,
  newCompanyFieldValue,
  type CompanyFieldValue,
} from "@/components/company-combobox";
import type { CompanyOption } from "@/lib/api/companies";
import {
  INDUSTRIES,
  WORK_TYPE_LABELS,
  SALARY_TYPE_LABELS,
  SALARY_PERIOD_LABELS,
} from "@/lib/constants";
import { withCurrentOption } from "@/lib/utils";
import {
  createJobAction,
  updateJobAction,
  type JobFormPayload,
  type JobActionResult,
} from "@/lib/actions/job-actions";

export interface JobFormValues {
  jobTitle: string;
  matchingIndustry: string;
  levelCode: string;
  provinceName: string;
  workType: string;
  currency: string;
  salaryMin: string;
  salaryMax: string;
  salaryType: string;
  salaryPeriod: string;
  deadline: string;
  skills: string;
  description: string;
  requirements: string;
  benefits: string;
  /** Chỉ dùng ở mode="edit" — job.ss_team_notes ("Ghi chú của team SS",
   *  hiện trên JD). KHÔNG nhầm với activityNote (lý do sửa, cho audit
   *  log, không hiện trên JD) — nhập riêng ở khối nút submit bên dưới. */
  ssTeamNotes: string;
}

/** Giá trị khởi tạo cho mode="create" — salary_period mặc định "MONTH"
 *  ("Tháng") theo đúng quy tắc bắt buộc của plan; salary_type/currency
 *  khớp default của JobCreate (NEGOTIABLE/VNĐ) thay vì suy theo thứ tự
 *  liệt kê cũ bên Flask (backend cũ khác, không còn đáng tin cậy để bắt
 *  chước thứ tự). */
export function emptyJobFormValues(): JobFormValues {
  return {
    jobTitle: "",
    matchingIndustry: INDUSTRIES[0],
    levelCode: "",
    provinceName: "",
    workType: "",
    currency: "VNĐ",
    salaryMin: "",
    salaryMax: "",
    salaryType: "NEGOTIABLE",
    salaryPeriod: "MONTH",
    deadline: "",
    skills: "",
    description: "",
    requirements: "",
    benefits: "",
    ssTeamNotes: "",
  };
}

function toPayload(values: JobFormValues): JobFormPayload {
  return {
    jobTitle: values.jobTitle,
    matchingIndustry: values.matchingIndustry,
    levelCode: values.levelCode,
    provinceName: values.provinceName,
    workType: values.workType,
    currency: values.currency,
    salaryMin: values.salaryMin,
    salaryMax: values.salaryMax,
    salaryType: values.salaryType,
    salaryPeriod: values.salaryPeriod,
    deadline: values.deadline,
    skills: values.skills,
    description: values.description,
    requirements: values.requirements,
    benefits: values.benefits,
  };
}

const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

type JobFormProps =
  | {
      mode: "create";
      companies: CompanyOption[];
      levels: string[];
      provinces: string[];
    }
  | {
      mode: "edit";
      jobId: string;
      initialValues: JobFormValues;
      levels: string[];
      provinces: string[];
    };

export function JobForm(props: JobFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<JobFormValues>(
    props.mode === "edit" ? props.initialValues : emptyJobFormValues(),
  );
  const [activityNote, setActivityNote] = useState("");
  const [companyField, setCompanyField] = useState<CompanyFieldValue>(newCompanyFieldValue());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const industryOptions = withCurrentOption([...INDUSTRIES], values.matchingIndustry);
  const levelOptions = withCurrentOption(props.levels, values.levelCode);
  const provinceOptions = withCurrentOption(props.provinces, values.provinceName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});
    setNotice(null);
    setIsPending(true);

    let result: JobActionResult;
    if (props.mode === "create") {
      result = await createJobAction(companyField, toPayload(values));
    } else {
      result = await updateJobAction(props.jobId, toPayload(values), values.ssTeamNotes, activityNote);
    }

    setIsPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.errorMessage ?? "Không thể lưu job, thử lại sau.");
      return;
    }

    if (props.mode === "create") {
      const parts: string[] = [];
      if (result.companyWasExisting) {
        parts.push(
          "Đã tìm thấy công ty trùng — job này được gắn vào công ty có sẵn, không tạo công ty mới.",
        );
      }
      if (result.jobWasExisting) {
        parts.push("Job trùng với job đã có (cùng công ty + vị trí + level + tỉnh) — không tạo job mới.");
      }
      router.push(parts.length > 0 ? `/jobs?notice=${encodeURIComponent(parts.join(" "))}` : "/jobs");
    } else {
      router.push(`/jobs/${props.jobId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {props.mode === "create" && (
        <div>
          <label className={labelClass}>
            Công ty <span className="text-destructive">*</span>
          </label>
          <CompanyCombobox
            companies={props.companies}
            value={companyField}
            onChange={setCompanyField}
            disabled={isPending}
          />
          <FieldError message={fieldErrors.company ?? fieldErrors.newCompanyName} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="jf-position" className={labelClass}>
            Vị trí tuyển dụng <span className="text-destructive">*</span>
          </label>
          <input
            id="jf-position"
            required
            disabled={isPending}
            value={values.jobTitle}
            onChange={(e) => update("jobTitle", e.target.value)}
            className={inputClass}
          />
          <FieldError message={fieldErrors.jobTitle} />
        </div>

        <div>
          <label htmlFor="jf-industry" className={labelClass}>
            Ngành <span className="text-destructive">*</span>
          </label>
          <select
            id="jf-industry"
            required
            disabled={isPending}
            value={values.matchingIndustry}
            onChange={(e) => update("matchingIndustry", e.target.value)}
            className={selectClass}
          >
            {industryOptions.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.matchingIndustry} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="jf-level" className={labelClass}>
            Level
          </label>
          <select
            id="jf-level"
            disabled={isPending}
            value={values.levelCode}
            onChange={(e) => update("levelCode", e.target.value)}
            className={selectClass}
          >
            <option value="">— chọn —</option>
            {levelOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jf-location" className={labelClass}>
            Địa điểm
          </label>
          <select
            id="jf-location"
            disabled={isPending}
            value={values.provinceName}
            onChange={(e) => update("provinceName", e.target.value)}
            className={selectClass}
          >
            <option value="">— chọn —</option>
            {provinceOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jf-work-type" className={labelClass}>
            Hình thức làm việc
          </label>
          <select
            id="jf-work-type"
            disabled={isPending}
            value={values.workType}
            onChange={(e) => update("workType", e.target.value)}
            className={selectClass}
          >
            <option value="">— chọn —</option>
            {Object.entries(WORK_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="jf-salary-type" className={labelClass}>
            Loại lương
          </label>
          <select
            id="jf-salary-type"
            disabled={isPending}
            value={values.salaryType}
            onChange={(e) => update("salaryType", e.target.value)}
            className={selectClass}
          >
            {Object.entries(SALARY_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jf-salary-period" className={labelClass}>
            Chu kỳ trả lương
          </label>
          <select
            id="jf-salary-period"
            disabled={isPending}
            value={values.salaryPeriod}
            onChange={(e) => update("salaryPeriod", e.target.value)}
            className={selectClass}
          >
            {Object.entries(SALARY_PERIOD_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jf-salary-min" className={labelClass}>
            Lương tối thiểu
          </label>
          <input
            id="jf-salary-min"
            type="number"
            min={0}
            disabled={isPending}
            value={values.salaryMin}
            onChange={(e) => update("salaryMin", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="jf-salary-max" className={labelClass}>
            Lương tối đa
          </label>
          <input
            id="jf-salary-max"
            type="number"
            min={0}
            disabled={isPending}
            value={values.salaryMax}
            onChange={(e) => update("salaryMax", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="jf-currency" className={labelClass}>
            Đơn vị tiền tệ
          </label>
          <select
            id="jf-currency"
            disabled={isPending}
            value={values.currency}
            onChange={(e) => update("currency", e.target.value)}
            className={selectClass}
          >
            <option value="VNĐ">VNĐ</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="jf-deadline" className={labelClass}>
            Deadline
          </label>
          <input
            id="jf-deadline"
            type="date"
            disabled={isPending}
            value={values.deadline}
            onChange={(e) => update("deadline", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="jf-skills" className={labelClass}>
          Kỹ năng / công nghệ yêu cầu (cách nhau bởi dấu phẩy)
        </label>
        <input
          id="jf-skills"
          disabled={isPending}
          value={values.skills}
          onChange={(e) => update("skills", e.target.value)}
          placeholder="SQL, Python, Excel"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="jf-description" className={labelClass}>
          Mô tả công việc
        </label>
        <textarea
          id="jf-description"
          rows={3}
          disabled={isPending}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="jf-requirements" className={labelClass}>
          Yêu cầu ứng viên
        </label>
        <textarea
          id="jf-requirements"
          rows={3}
          disabled={isPending}
          value={values.requirements}
          onChange={(e) => update("requirements", e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="jf-benefits" className={labelClass}>
          Quyền lợi
        </label>
        <textarea
          id="jf-benefits"
          rows={2}
          disabled={isPending}
          value={values.benefits}
          onChange={(e) => update("benefits", e.target.value)}
          className={inputClass}
        />
      </div>

      {props.mode === "edit" && (
        <>
          <div>
            <label htmlFor="jf-ss-notes" className={labelClass}>
              Ghi chú của team SS
            </label>
            <textarea
              id="jf-ss-notes"
              rows={2}
              disabled={isPending}
              value={values.ssTeamNotes}
              onChange={(e) => update("ssTeamNotes", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="jf-activity-note" className={labelClass}>
              Ghi chú lịch sử thao tác (không bắt buộc)
            </label>
            <textarea
              id="jf-activity-note"
              rows={2}
              disabled={isPending}
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
              placeholder="Lý do sửa job này — không bắt buộc, các ss_team khác sẽ xem được ở mục Lịch sử thao tác…"
              className={inputClass}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Đang lưu…" : props.mode === "edit" ? "Lưu thay đổi" : "Lưu job"}
        </button>
        <Link
          href={props.mode === "edit" ? `/jobs/${props.jobId}` : "/jobs"}
          className="text-sm text-muted-foreground underline"
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
