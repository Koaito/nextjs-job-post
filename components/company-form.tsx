"use client";
// components/company-form.tsx
// Tương đương _company_form.html — Nhóm 2, Phần 1 của plan. <CompanyForm>
// dùng chung cho tạo (mode="create", gắn ở tab "Công ty" của /them-moi —
// quyết định đã chốt: gắn luôn trong Phần 1, KHÔNG có route /companies/add
// riêng) và sửa (mode="edit", /companies/[companyId]/edit).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CITIES_VN, PARTNERSHIP_POTENTIAL_CODES, PARTNERSHIP_POTENTIAL_LABELS, COMPANY_SIZE_PATTERN } from "@/lib/constants";
import { withCurrentOption } from "@/lib/utils";
import type { PotentialSuggestion } from "@/lib/company-potential";
import {
  createCompanyAction,
  updateCompanyAction,
  type CompanyFormPayload,
  type CompanyActionResult,
} from "@/lib/actions/company-actions";

export interface CompanyFormValues {
  companyName: string;
  taxId: string;
  website: string;
  industry: string;
  companySize: string;
  address: string;
  provinceName: string;
  fanpageUrl: string;
  linkedinUrl: string;
  partnershipPotential: string;
}

/** partnership_potential mặc định "UNVERIFIED" khi tạo mới, khớp default
 *  của CompanyCreate — không suy theo thứ tự PARTNERSHIP_POTENTIAL_CODES
 *  (mảng đó phục vụ hiển thị dropdown theo đúng thứ tự Flask, không phải
 *  thứ tự ưu tiên chọn mặc định). */
export function emptyCompanyFormValues(): CompanyFormValues {
  return {
    companyName: "",
    taxId: "",
    website: "",
    industry: "",
    companySize: "",
    address: "",
    provinceName: "",
    fanpageUrl: "",
    linkedinUrl: "",
    partnershipPotential: "UNVERIFIED",
  };
}

function toPayload(values: CompanyFormValues): CompanyFormPayload {
  return { ...values };
}

const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

const SUGGESTION_STYLES: Record<PotentialSuggestion["level"], string> = {
  HIGH: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-muted text-muted-foreground",
};

/** Badge "🤖 Gợi ý: …" cạnh dropdown Tiềm năng hợp tác, kèm tooltip liệt
 *  kê từng tiêu chí (khớp .potential-suggestion-tooltip bên Flask) — CHỈ
 *  gợi ý, không tự chọn thay staff (xem lib/company-potential.ts). */
function PotentialSuggestionBadge({ suggestion }: { suggestion: PotentialSuggestion }) {
  return (
    <div className="mt-1.5 group relative inline-block">
      <span
        className={`inline-flex cursor-help items-center rounded-full px-2 py-0.5 text-xs font-medium ${SUGGESTION_STYLES[suggestion.level]}`}
      >
        🤖 Gợi ý: {PARTNERSHIP_POTENTIAL_LABELS[suggestion.level]} ({suggestion.score}/{suggestion.maxScore} tiêu
        chí)
      </span>
      <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-72 rounded-md border bg-popover p-3 text-xs shadow-md group-hover:block">
        <p className="mb-1.5 font-semibold">Tiêu chí đang xét:</p>
        <ul className="space-y-1">
          {suggestion.criteria.map((c) => (
            <li key={c.label} className={c.met ? "text-emerald-700" : "text-muted-foreground"}>
              <span className="mr-1">{c.met ? "✓" : "✗"}</span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Chỉ là gợi ý tự động — bạn tự quyết định có chọn theo hay không. Di chuột vào để xem chi tiết tiêu chí.
      </p>
    </div>
  );
}

type CompanyFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      companyId: string;
      initialValues: CompanyFormValues;
      suggestion: PotentialSuggestion;
    };

export function CompanyForm(props: CompanyFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormValues>(
    props.mode === "edit" ? props.initialValues : emptyCompanyFormValues(),
  );
  const [activityNote, setActivityNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const cityOptions = withCurrentOption([...CITIES_VN], values.provinceName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});
    setIsPending(true);

    let result: CompanyActionResult;
    if (props.mode === "create") {
      result = await createCompanyAction(toPayload(values));
    } else {
      result = await updateCompanyAction(props.companyId, toPayload(values), activityNote);
    }

    setIsPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.errorMessage ?? "Không thể lưu công ty, thử lại sau.");
      return;
    }

    if (props.mode === "create") {
      const notice = result.wasExisting
        ? "Đã tìm thấy công ty trùng (trùng mã số thuế hoặc tên) — hồ sơ có sẵn được cập nhật thêm, không tạo bản ghi mới."
        : "Đã tạo công ty mới.";
      router.push(`/companies/${result.companyId}?notice=${encodeURIComponent(notice)}`);
    } else {
      router.push(`/companies/${props.companyId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div>
        <label htmlFor="cf-name" className={labelClass}>
          Tên công ty <span className="text-destructive">*</span>
        </label>
        <input
          id="cf-name"
          required
          disabled={isPending}
          value={values.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          className={inputClass}
        />
        <FieldError message={fieldErrors.companyName} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-tax-id" className={labelClass}>
            Mã số thuế
          </label>
          <input
            id="cf-tax-id"
            disabled={isPending}
            value={values.taxId}
            onChange={(e) => update("taxId", e.target.value)}
            placeholder="Nếu điền đúng, tự khớp công ty đã crawl trước đó"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cf-website" className={labelClass}>
            Website
          </label>
          <input
            id="cf-website"
            type="url"
            disabled={isPending}
            value={values.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="cf-industry" className={labelClass}>
          Lĩnh vực hoạt động
        </label>
        <input
          id="cf-industry"
          disabled={isPending}
          value={values.industry}
          onChange={(e) => update("industry", e.target.value)}
          placeholder="VD: Fintech, E-commerce…"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-size" className={labelClass}>
            Quy mô nhân sự
          </label>
          <input
            id="cf-size"
            disabled={isPending}
            value={values.companySize}
            onChange={(e) => update("companySize", e.target.value)}
            placeholder="VD: 200-500"
            title="Chỉ nhập số và dấu gạch ngang (VD: 100-200, 500)"
            className={inputClass}
          />
          <FieldError
            message={
              fieldErrors.companySize ??
              (values.companySize.trim() && !COMPANY_SIZE_PATTERN.test(values.companySize.trim())
                ? "Chỉ nhập số và dấu gạch ngang (VD: 100-200, 500)."
                : undefined)
            }
          />
        </div>

        <div>
          <label htmlFor="cf-city" className={labelClass}>
            Tỉnh/Thành
          </label>
          <select
            id="cf-city"
            disabled={isPending}
            value={values.provinceName}
            onChange={(e) => update("provinceName", e.target.value)}
            className={selectClass}
          >
            <option value="">Chọn tỉnh/thành phố…</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="cf-address" className={labelClass}>
          Địa chỉ
        </label>
        <input
          id="cf-address"
          disabled={isPending}
          value={values.address}
          onChange={(e) => update("address", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-fanpage" className={labelClass}>
            Link fanpage
          </label>
          <input
            id="cf-fanpage"
            type="url"
            disabled={isPending}
            value={values.fanpageUrl}
            onChange={(e) => update("fanpageUrl", e.target.value)}
            placeholder="https://facebook.com/..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cf-linkedin" className={labelClass}>
            Link LinkedIn công ty
          </label>
          <input
            id="cf-linkedin"
            type="url"
            disabled={isPending}
            value={values.linkedinUrl}
            onChange={(e) => update("linkedinUrl", e.target.value)}
            placeholder="https://linkedin.com/company/..."
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="cf-potential" className={labelClass}>
          Tiềm năng hợp tác
        </label>
        <select
          id="cf-potential"
          disabled={isPending}
          value={values.partnershipPotential}
          onChange={(e) => update("partnershipPotential", e.target.value)}
          className={selectClass}
        >
          {PARTNERSHIP_POTENTIAL_CODES.map((code) => (
            <option key={code} value={code}>
              {PARTNERSHIP_POTENTIAL_LABELS[code]}
            </option>
          ))}
        </select>
        {props.mode === "edit" && <PotentialSuggestionBadge suggestion={props.suggestion} />}
      </div>

      {props.mode === "edit" && (
        <div>
          <label htmlFor="cf-activity-note" className={labelClass}>
            Ghi chú lịch sử thao tác (không bắt buộc)
          </label>
          <textarea
            id="cf-activity-note"
            rows={2}
            disabled={isPending}
            value={activityNote}
            onChange={(e) => setActivityNote(e.target.value)}
            placeholder="Lý do sửa hồ sơ công ty này — không bắt buộc, các ss_team khác sẽ xem được ở mục Lịch sử thao tác…"
            className={inputClass}
          />
        </div>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Đang lưu…" : props.mode === "edit" ? "Lưu thay đổi" : "Lưu công ty"}
        </button>
        <Link
          href={props.mode === "edit" ? `/companies/${props.companyId}` : "/companies"}
          className="text-sm text-muted-foreground underline"
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
