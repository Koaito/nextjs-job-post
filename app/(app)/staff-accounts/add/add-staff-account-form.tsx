"use client";
// app/(app)/staff-accounts/add/add-staff-account-form.tsx
// Form tạo tài khoản + thẻ "mật khẩu tạm" của /staff-accounts/add — Nhóm 3,
// Đợt 3.2, Phần 2/4.
//
// MẬT KHẨU TẠM CHỈ HIỆN ĐÚNG 1 LẦN (plan Nhóm 3): backend chỉ lưu hash, không
// endpoint nào lấy lại được. Bản Flask giữ trong session rồi hiện ở trang
// danh sách; ở đây giữ thẳng trong state client ngay sau khi server action
// trả về (không URL/query, không localStorage, không refetch). Rời hoặc tải
// lại trang là mất — đúng ý đồ, thẻ có ghi rõ cho admin.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";
import {
  createStaffAccountAction,
  type CreatedStaffAccount,
} from "@/lib/actions/staff-account-actions";

const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";
const ROLES = Object.keys(ROLE_LABELS);

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function AddStaffAccountForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ss_team"); // mặc định giống Flask
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [created, setCreated] = useState<CreatedStaffAccount | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Chặn sớm phía client (giống required + .trim() của Flask), lỗi khác để
    // action/backend báo. Input giữ nguyên khi lỗi.
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Vui lòng nhập họ tên.";
    if (!email.trim()) errs.email = "Vui lòng nhập email.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setErrorMessage("Vui lòng điền đầy đủ họ tên và email.");
      return;
    }

    setIsPending(true);
    const result = await createStaffAccountAction({ fullName, email, role });
    setIsPending(false);

    if (!result.ok || !result.account) {
      setFieldErrors(result.fieldErrors ?? {});
      setErrorMessage(result.message ?? "Không thể tạo tài khoản, thử lại sau.");
      return;
    }

    setCreated(result.account);
    setFullName("");
    setEmail("");
    setRole("ss_team");
  }

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Đã sao chép mật khẩu tạm.");
    } catch {
      toast.error("Không sao chép được — hãy bôi đen và copy thủ công.");
    }
  }

  if (created) {
    return (
      <div className="space-y-4 rounded-md border border-primary p-5">
        <h2 className="font-heading text-lg font-semibold">✅ Đã tạo tài khoản cho {created.fullName}</h2>
        <p className="text-sm">
          Gửi thông tin dưới đây cho {created.fullName} qua kênh nội bộ (Slack/nói miệng) — mật khẩu tạm{" "}
          <strong>chỉ hiện đúng 1 lần ở đây</strong>, rời hoặc tải lại trang là mất, không có cách lấy lại.
        </p>
        <dl className="space-y-1 rounded-md bg-muted px-3 py-2 text-sm">
          <div>Email: {created.email}</div>
          <div>Role: {ROLE_LABELS[created.role] ?? created.role}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Mật khẩu tạm:</span>
            <code className="rounded bg-background px-2 py-0.5 font-mono select-all">{created.tempPassword}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => copyPassword(created.tempPassword)}>
              Sao chép
            </Button>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Tài khoản bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setCreated(null)}>
            Tạo tài khoản khác
          </Button>
          <Link href="/staff-accounts" className={buttonVariants({ variant: "outline" })}>
            Về danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-md border p-5">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div>
        <label htmlFor="sa-full-name" className={labelClass}>
          Họ tên <span className="text-destructive">*</span>
        </label>
        <input
          id="sa-full-name"
          required
          maxLength={255}
          disabled={isPending}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
        <FieldError message={fieldErrors.fullName} />
      </div>

      <div>
        <label htmlFor="sa-email" className={labelClass}>
          Email <span className="text-destructive">*</span>
        </label>
        <input
          id="sa-email"
          type="email"
          required
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <FieldError message={fieldErrors.email} />
      </div>

      <div>
        <label htmlFor="sa-role" className={labelClass}>
          Role
        </label>
        <select
          id="sa-role"
          disabled={isPending}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.role} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Đang tạo…" : "Tạo tài khoản"}
        </Button>
        <Link href="/staff-accounts" className={buttonVariants({ variant: "ghost" })}>
          Hủy
        </Link>
      </div>
    </form>
  );
}
