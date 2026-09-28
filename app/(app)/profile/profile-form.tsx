"use client";
// app/(app)/profile/profile-form.tsx
// Form sửa hồ sơ ở /profile — tương đương <form> trong profile_overview.html.
//   - Họ và tên: mọi role, bắt buộc.
//   - Số điện thoại + Định hướng ngành: CHỈ học viên (ẩn hẳn với staff —
//     backend ép NULL cho staff nên hiện ô nhập rồi âm thầm không lưu là
//     đánh lừa người dùng; plan Phần 2 mục 3).
// Lỗi validate: tô đỏ tại chỗ và GIỮ NGUYÊN mọi thứ đã nhập (state nằm ở
// component này nên không bị reset khi action trả lỗi).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { INDUSTRIES, TRACK_OTHER } from "@/lib/constants";
import { updateProfileAction, type ProfileInput } from "@/lib/actions/profile-actions";

const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function ProfileForm({
  isStudent,
  initialValues,
}: {
  isStudent: boolean;
  initialValues: ProfileInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileInput>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof ProfileInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Định hướng ngành đang lưu nhưng không còn trong danh sách (dữ liệu cũ):
  // vẫn liệt kê để chọn sẵn, tránh lưu lại là âm thầm xoá mất giá trị.
  const knownTracks: readonly string[] = [...INDUSTRIES, TRACK_OTHER];
  const extraTrack = values.track && !knownTracks.includes(values.track) ? values.track : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!values.fullName.trim()) {
      setFieldErrors({ fullName: "Vui lòng nhập họ và tên." });
      setErrorMessage("Vui lòng nhập họ và tên.");
      return;
    }

    setIsPending(true);
    const result = await updateProfileAction(values);
    setIsPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.message ?? "Không thể cập nhật thông tin, thử lại sau.");
      return;
    }

    toast.success(result.message ?? "Đã cập nhật thông tin cá nhân.");
    // Action đã revalidate layout; refresh để sidebar/thông tin đọc lại
    // dữ liệu mới (tên mới hiện ngay, không cần F5).
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div>
        <label htmlFor="pf-full-name" className={labelClass}>
          Họ và tên <span className="text-destructive">*</span>
        </label>
        <input
          id="pf-full-name"
          required
          maxLength={255}
          disabled={isPending}
          value={values.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          className={inputClass}
        />
        <FieldError message={fieldErrors.fullName} />
      </div>

      {isStudent && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-phone" className={labelClass}>
              Số điện thoại
            </label>
            <input
              id="pf-phone"
              maxLength={30}
              disabled={isPending}
              value={values.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={inputClass}
            />
            <FieldError message={fieldErrors.phone} />
          </div>

          <div>
            <label htmlFor="pf-track" className={labelClass}>
              Định hướng ngành
            </label>
            <select
              id="pf-track"
              disabled={isPending}
              value={values.track}
              onChange={(e) => update("track", e.target.value)}
              className={inputClass}
            >
              <option value="">— chọn —</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
              <option value={TRACK_OTHER}>{TRACK_OTHER}</option>
              {extraTrack && <option value={extraTrack}>{extraTrack}</option>}
            </select>
            <FieldError message={fieldErrors.track} />
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
