"use client";
// components/email-template-form.tsx
// Form thêm/sửa mẫu email — phần form của _email_template_manager.html
// (Flask). Nhóm 2, Phần 3 của plan.
//
// Luật note (plan Nhóm 2, dòng "Xoá 1 mẫu email là hard-delete thật"):
//   - Thêm mới: KHÔNG bắt buộc.
//   - Sửa: BẮT BUỘC vô điều kiện — lần nào bấm Lưu cũng phải có note, KHÔNG
//     áp luật "chỉ bắt khi có thay đổi thật" (luật đó chỉ dành riêng cho
//     Contact/Company). Note tự .trim() và chặn submit nếu rỗng (plan
//     dòng 192).
//
// Lỗi validate (server action trả fieldErrors): tô đỏ tại chỗ + GIỮ NGUYÊN
// mọi thứ đã nhập (plan Nhóm 1, add_hub) — state form nằm ở component này
// nên không bị reset khi action trả lỗi.
//
// Danh sách placeholder gợi ý nhận từ props (page cha gọi GET
// /email-templates/placeholder-help 1 lần) — không hard-code (plan Nhóm 2).

import { useState } from "react";
import { CONTACT_STATUS_CODES, CONTACT_STATUS_LABELS } from "@/lib/constants";
import type { EmailTemplateInput } from "@/lib/api/email-templates";
import {
  createEmailTemplateAction,
  updateEmailTemplateAction,
  type EmailTemplateFormActionResult,
} from "@/lib/actions/email-template-actions";
import { Button } from "@/components/ui/button";

export function emptyEmailTemplateInput(): EmailTemplateInput {
  return { title: "", description: "", body: "", recommendedFor: [], displayOrder: "0" };
}

const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

type EmailTemplateFormProps = {
  placeholderHelp: Record<string, string>;
  /** Gọi sau khi lưu thành công (page cha đóng form + refresh + toast). */
  onSuccess: (message: string) => void;
  onCancel: () => void;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      templateId: string;
      initialValues: EmailTemplateInput;
    }
);

export function EmailTemplateForm(props: EmailTemplateFormProps) {
  const isEdit = props.mode === "edit";
  const [values, setValues] = useState<EmailTemplateInput>(
    props.mode === "edit" ? props.initialValues : emptyEmailTemplateInput(),
  );
  const [activityNote, setActivityNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof EmailTemplateInput>(key: K, value: EmailTemplateInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleStatus(code: string, checked: boolean) {
    setValues((v) => ({
      ...v,
      recommendedFor: checked ? [...v.recommendedFor, code] : v.recommendedFor.filter((c) => c !== code),
    }));
  }

  // Sửa mẫu email: note luôn bắt buộc (không phụ thuộc có đổi field hay không).
  const noteRequired = isEdit;
  const clearedDescription =
    props.mode === "edit" && values.description.trim() === "" && props.initialValues.description.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (props.mode === "edit" && !activityNote.trim()) {
      setFieldErrors({ activityNote: "Vui lòng nhập lý do sửa." });
      setErrorMessage("Sửa mẫu email bắt buộc phải có ghi chú lý do.");
      return;
    }

    setIsPending(true);
    let result: EmailTemplateFormActionResult;
    if (props.mode === "create") {
      result = await createEmailTemplateAction(values, activityNote);
    } else {
      result = await updateEmailTemplateAction(props.templateId, values, activityNote);
    }
    setIsPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.errorMessage ?? "Không thể lưu mẫu email, thử lại sau.");
      return;
    }
    props.onSuccess(isEdit ? "Đã cập nhật mẫu email." : "Đã thêm mẫu email.");
  }

  const placeholders = Object.entries(props.placeholderHelp);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      <h3 className="font-heading text-lg font-semibold">{isEdit ? "Sửa mẫu email" : "Thêm mẫu email mới"}</h3>

      {placeholders.length > 0 && (
        <details className="rounded-md border bg-muted/40 px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Danh sách placeholder có thể dùng trong nội dung mẫu
          </summary>
          <dl className="mt-2 space-y-2 text-sm">
            {placeholders.map(([ph, help]) => (
              <div key={ph}>
                <dt>
                  <code className="font-mono text-xs">{ph}</code>
                </dt>
                <dd className="text-muted-foreground">{help}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-3">
          <label htmlFor="etf-title" className={labelClass}>
            Tiêu đề mẫu <span className="text-destructive">*</span>
          </label>
          <input
            id="etf-title"
            required
            maxLength={255}
            disabled={isPending}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            className={inputClass}
          />
          <FieldError message={fieldErrors.title} />
        </div>

        <div>
          <label htmlFor="etf-order" className={labelClass}>
            Thứ tự hiển thị
          </label>
          <input
            id="etf-order"
            type="number"
            disabled={isPending}
            value={values.displayOrder}
            onChange={(e) => update("displayOrder", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-4">
          <label htmlFor="etf-desc" className={labelClass}>
            Mô tả ngắn (hiện dưới tiêu đề trong popup chọn mẫu)
          </label>
          <input
            id="etf-desc"
            maxLength={500}
            disabled={isPending}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputClass}
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <div className="sm:col-span-4">
          <label htmlFor="etf-body" className={labelClass}>
            Nội dung mẫu <span className="text-destructive">*</span>
          </label>
          <textarea
            id="etf-body"
            required
            rows={10}
            disabled={isPending}
            value={values.body}
            onChange={(e) => update("body", e.target.value)}
            className={`${inputClass} min-h-[220px] resize-y leading-relaxed`}
          />
          <FieldError message={fieldErrors.body} />
        </div>

        <fieldset className="sm:col-span-4" disabled={isPending}>
          <legend className={labelClass}>Gợi ý cho trạng thái contact</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CONTACT_STATUS_CODES.map((code) => (
              <label key={code} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.recommendedFor.includes(code)}
                  onChange={(e) => toggleStatus(code, e.target.checked)}
                />
                {CONTACT_STATUS_LABELS[code] ?? code}
              </label>
            ))}
          </div>
          <FieldError message={fieldErrors.recommendedFor} />
        </fieldset>
      </div>

      {clearedDescription && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Mô tả bị xoá trắng sẽ được giữ nguyên giá trị cũ khi lưu — hệ thống chưa hỗ trợ xoá trống một mô tả đã có.
        </p>
      )}

      <div>
        <label htmlFor="etf-note" className={labelClass}>
          {isEdit ? (
            <>
              Ghi chú lịch sử thao tác — <strong>bắt buộc</strong> <span className="text-destructive">*</span>
            </>
          ) : (
            "Ghi chú lịch sử thao tác (không bắt buộc)"
          )}
        </label>
        <textarea
          id="etf-note"
          rows={2}
          required={noteRequired}
          disabled={isPending}
          value={activityNote}
          onChange={(e) => setActivityNote(e.target.value)}
          placeholder={
            isEdit
              ? "Lý do sửa mẫu email này (các ss_team khác sẽ xem được ở mục Lịch sử thao tác)…"
              : "Ghi chú thêm nếu cần (không bắt buộc)…"
          }
          className={inputClass}
        />
        <FieldError message={fieldErrors.activityNote} />
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Lưu mẫu email"}
        </Button>
        <Button type="button" variant="ghost" onClick={props.onCancel} disabled={isPending}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
