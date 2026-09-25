"use client";
// app/(app)/companies/[companyId]/delete-company-button.tsx
// Xoá MỀM công ty — note BẮT BUỘC (khớp DELETE /companies/{id}, backend
// trả 422 nếu thiếu/rỗng) — khác nút "Đóng job" (job-status-panel.tsx,
// note tuỳ chọn). Xoá xong điều hướng về /companies (company không còn
// tồn tại ở nơi đang đứng).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteCompanyAction } from "@/lib/actions/company-actions";

export function DeleteCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    const result = await deleteCompanyAction(companyId, note);
    if (result.ok) {
      router.push(`/companies?notice=${encodeURIComponent(result.message)}`);
    }
    return result;
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Xoá công ty
      </Button>
      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xoá công ty"
        description={
          <>
            Công ty &ldquo;{companyName}&rdquo; sẽ bị xoá mềm — ẩn khỏi danh sách /companies, không hiện gợi ý
            trùng khi tạo công ty mới nữa. Job/contact liên quan vẫn còn trong hệ thống.
          </>
        }
        noteLabel="Lý do xoá"
        notePlaceholder="Nhập lý do xoá công ty này…"
        noteRequired
        confirmLabel="Xoá công ty"
        danger
        onConfirm={handleConfirm}
      />
    </>
  );
}
