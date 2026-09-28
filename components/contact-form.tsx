"use client";
// components/contact-form.tsx
// Tương đương _contact_form.html — Nhóm 2, Phần 2, mục 2 của plan.
// <ContactForm> dùng chung cho tạo (mode="create") và sửa (mode="edit"):
//   - create, KHÔNG có công ty gắn sẵn: hiện <CompanyCombobox> (2 chế độ —
//     chọn công ty có sẵn / "＋ Tạo công ty mới…"). Gắn ở tab "Người liên
//     hệ" của /them-moi, `companies` do page cha load 1 LẦN rồi truyền
//     xuống (cùng tab Job — xem docstring company-combobox.tsx).
//   - create, CÓ công ty gắn sẵn (`fixedCompany`): ẩn combobox, hiện tên
//     công ty. Khớp nhánh `company` khác None của _contact_form.html.
//   - edit: công ty cố định, ghi chú (note) chỉ BẮT BUỘC khi có field thật
//     sự đổi (xem `hasEffectiveChange` bên dưới). Form sửa được mở trong
//     <EditContactDialog> (không có trang sửa riêng — plan không liệt kê
//     route GET nào cho việc sửa contact, đã chốt với user dùng Dialog để
//     staff ở lại đúng trang đang đứng, giữ nguyên bộ lọc).
//
// onSuccess/onCancel: nhúng trong Dialog thì truyền 2 prop này để form KHÔNG
// tự router.push — nơi nhúng tự đóng dialog + refresh. Không truyền thì giữ
// hành vi điều hướng như /them-moi và trang thêm contact theo công ty.
//
// Luật note (plan Nhóm 2, mục 4): UPDATE — chỉ đòi note khi giá trị thật
// sự đổi; Flask luôn gắn `required` cho ô note ở form sửa (kể cả khi chưa
// gõ gì đổi), Next.js làm "khôn" hơn theo đúng hướng plan cho phép. Backend
// vẫn là lớp chặn cuối (422 nếu thiếu note khi có đổi).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CompanyCombobox, type CompanyFieldValue } from "@/components/company-combobox";
import type { CompanyOption } from "@/lib/api/companies";
import type { ContactInput } from "@/lib/api/contacts";
import {
  createContactAction,
  updateContactAction,
  type ContactFormActionResult,
} from "@/lib/actions/contact-actions";

export type ContactFormValues = ContactInput;

export function emptyContactFormValues(): ContactFormValues {
  return { contactName: "", title: "", email: "", contactLink: "", phone: "", source: "" };
}

const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

interface ContactFormCallbacks {
  /** Có truyền -> KHÔNG tự điều hướng sau khi lưu; gọi hàm này kèm thông
   *  báo thành công để nơi nhúng (vd Dialog) tự xử lý. */
  onSuccess?: (message: string) => void;
  /** Có truyền -> nút "Hủy" là <button> gọi hàm này thay vì <Link>. */
  onCancel?: () => void;
}

type ContactFormProps = ContactFormCallbacks &
  (
    | {
        mode: "create";
        /** Danh sách công ty cho combobox — cần khi KHÔNG có fixedCompany
         *  (/them-moi); thêm contact ngay trong 1 công ty thì bỏ qua. */
        companies?: CompanyOption[];
        /** Công ty gắn sẵn (thêm contact từ trang chi tiết công ty). */
        fixedCompany?: { id: string; name: string };
      }
    | {
        mode: "edit";
        companyId: string;
        companyName: string;
        contactId: string;
        initialValues: ContactFormValues;
      }
  );

const FIELD_KEYS = ["contactName", "title", "email", "contactLink", "phone", "source"] as const;

/** Có field nào THẬT SỰ đổi so với giá trị gốc không? Field xoá trắng
 *  KHÔNG tính là đổi: backend coi null = "giữ nguyên" nên gửi lên cũng
 *  không xoá được (khớp Flask — xem updateContact() ở lib/api/contacts.ts). */
function hasEffectiveChange(current: ContactFormValues, initial: ContactFormValues): boolean {
  return FIELD_KEYS.some((k) => {
    const now = current[k].trim();
    return now !== "" && now !== initial[k].trim();
  });
}

function hasClearedField(current: ContactFormValues, initial: ContactFormValues): boolean {
  return FIELD_KEYS.some((k) => current[k].trim() === "" && initial[k].trim() !== "");
}

export function ContactForm(props: ContactFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ContactFormValues>(
    props.mode === "edit" ? props.initialValues : emptyContactFormValues(),
  );
  // Mặc định "existing" + chưa chọn (khớp Flask: combobox chọn công ty có
  // sẵn, thiếu thì báo "Cần chọn công ty") — KHÁC JobForm mặc định "new".
  const [companyField, setCompanyField] = useState<CompanyFieldValue>({ mode: "existing", companyId: "" });
  const [activityNote, setActivityNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const isEdit = props.mode === "edit";
  const changed = props.mode === "edit" ? hasEffectiveChange(values, props.initialValues) : false;
  const cleared = props.mode === "edit" ? hasClearedField(values, props.initialValues) : false;
  const noteRequired = isEdit && changed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (props.mode === "edit") {
      if (!changed) {
        // Không có gì thật sự đổi -> khỏi gọi API (backend cũng bỏ qua yêu
        // cầu note khi không có thay đổi, nhưng không cần round-trip).
        if (props.onSuccess) {
          props.onSuccess("Không có thay đổi nào để lưu.");
          return;
        }
        router.push(
          `/companies/${props.companyId}?notice=${encodeURIComponent("Không có thay đổi nào để lưu.")}`,
        );
        return;
      }
      if (!activityNote.trim()) {
        setFieldErrors({ activityNote: "Vui lòng nhập lý do sửa." });
        setErrorMessage("Sửa thông tin người liên hệ bắt buộc phải có ghi chú lý do.");
        return;
      }
    }

    setIsPending(true);
    let result: ContactFormActionResult;
    if (props.mode === "create") {
      const field: CompanyFieldValue = props.fixedCompany
        ? { mode: "existing", companyId: props.fixedCompany.id }
        : companyField;
      result = await createContactAction(field, values, activityNote);
    } else {
      result = await updateContactAction(props.companyId, props.contactId, values, activityNote);
    }
    setIsPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.errorMessage ?? "Không thể lưu người liên hệ, thử lại sau.");
      return;
    }

    if (props.mode === "edit" && props.onSuccess) {
      props.onSuccess("Đã cập nhật người liên hệ.");
      return;
    }

    if (props.mode === "create") {
      const notice = result.companyWasExisting
        ? "Đã thêm người liên hệ. Lưu ý: công ty bạn nhập đã có sẵn (trùng mã số thuế hoặc tên) nên contact được gắn vào hồ sơ đó."
        : "Đã thêm người liên hệ.";
      // Khớp Flask: thêm trong context công ty -> về chi tiết công ty; thêm
      // ở /them-moi -> về danh sách /contacts (trang này đọc sẵn ?notice=).
      if (props.onSuccess) {
        props.onSuccess(notice);
        return;
      }
      const target = props.fixedCompany ? `/companies/${props.fixedCompany.id}` : "/contacts";
      router.push(`${target}?notice=${encodeURIComponent(notice)}`);
    } else {
      router.push(`/companies/${props.companyId}?notice=${encodeURIComponent("Đã cập nhật người liên hệ.")}`);
    }
  }

  const cancelHref =
    props.mode === "edit"
      ? `/companies/${props.companyId}`
      : props.fixedCompany
        ? `/companies/${props.fixedCompany.id}`
        : "/contacts";

  const fixedCompanyName =
    props.mode === "edit" ? props.companyName : props.fixedCompany ? props.fixedCompany.name : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {fixedCompanyName !== null ? (
        <div>
          <span className={labelClass}>Công ty</span>
          <p className="rounded-md bg-muted px-3 py-2 text-sm">{fixedCompanyName}</p>
        </div>
      ) : (
        props.mode === "create" && (
          <div>
            <label className={labelClass}>
              Công ty <span className="text-destructive">*</span>
            </label>
            {/* idPrefix riêng: /them-moi mount cả tab Job (cũng có combobox)
                cùng lúc, id trùng sẽ làm label focus nhầm ô của tab kia. */}
            <CompanyCombobox
              idPrefix="contact-cc"
              companies={props.companies ?? []}
              value={companyField}
              onChange={setCompanyField}
              disabled={isPending}
            />
            <FieldError message={fieldErrors.company} />
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ctf-name" className={labelClass}>
            Tên người liên hệ <span className="text-destructive">*</span>
          </label>
          <input
            id="ctf-name"
            required
            disabled={isPending}
            value={values.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            className={inputClass}
          />
          <FieldError message={fieldErrors.contactName} />
        </div>

        <div>
          <label htmlFor="ctf-title" className={labelClass}>
            Chức danh
          </label>
          <input
            id="ctf-title"
            disabled={isPending}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="HR, Recruiter, Hiring Manager…"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ctf-email" className={labelClass}>
            Email công việc (nếu công khai)
          </label>
          <input
            id="ctf-email"
            type="email"
            disabled={isPending}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ctf-link" className={labelClass}>
            LinkedIn/Facebook công việc
          </label>
          <input
            id="ctf-link"
            type="url"
            disabled={isPending}
            value={values.contactLink}
            onChange={(e) => update("contactLink", e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ctf-phone" className={labelClass}>
            Số điện thoại công việc (nếu công khai)
          </label>
          <input
            id="ctf-phone"
            disabled={isPending}
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ctf-source" className={labelClass}>
            Nguồn tìm thấy
          </label>
          <input
            id="ctf-source"
            disabled={isPending}
            value={values.source}
            onChange={(e) => update("source", e.target.value)}
            placeholder="LinkedIn, JD tuyển dụng, fanpage…"
            className={inputClass}
          />
        </div>
      </div>

      {cleared && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Ô nào bị xoá trắng sẽ được giữ nguyên giá trị cũ khi lưu — hệ thống chưa hỗ trợ xoá trống một thông tin đã
          có.
        </p>
      )}

      <div>
        <label htmlFor="ctf-note" className={labelClass}>
          {isEdit ? (
            <>
              Ghi chú lịch sử thao tác
              {noteRequired ? (
                <>
                  {" "}
                  — <strong>bắt buộc</strong> <span className="text-destructive">*</span>
                </>
              ) : (
                " (chỉ bắt buộc khi bạn sửa thông tin)"
              )}
            </>
          ) : (
            "Ghi chú lịch sử thao tác (không bắt buộc)"
          )}
        </label>
        <textarea
          id="ctf-note"
          rows={2}
          required={noteRequired}
          disabled={isPending}
          value={activityNote}
          onChange={(e) => setActivityNote(e.target.value)}
          placeholder={
            isEdit
              ? "Lý do sửa thông tin người liên hệ này — các ss_team khác sẽ xem được ở mục Lịch sử thao tác…"
              : "Ghi chú thêm nếu cần (không bắt buộc)…"
          }
          className={inputClass}
        />
        <FieldError message={fieldErrors.activityNote} />
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Lưu người liên hệ"}
        </button>
        {props.onCancel ? (
          <button
            type="button"
            onClick={props.onCancel}
            disabled={isPending}
            className="text-sm text-muted-foreground underline"
          >
            Hủy
          </button>
        ) : (
          <Link href={cancelHref} className="text-sm text-muted-foreground underline">
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
