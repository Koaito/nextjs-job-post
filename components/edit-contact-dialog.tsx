"use client";
// components/edit-contact-dialog.tsx
// Nút "Sửa" + Dialog chứa <ContactForm mode="edit"> — Nhóm 2, Phần 2, mục 2.
//
// Plan (bảng route dòng 422) chỉ ghi `.../contacts/<id>/edit` là server
// action, KHÔNG liệt kê trang GET sửa contact. Đã chốt với user: dùng Dialog
// thay vì route riêng như Flask (contacts.edit()) — staff ở lại đúng trang
// đang đứng (giữ bộ lọc ở /contacts), không hardcode redirect về trang công
// ty (cùng loại lỗi plan dòng 988 đã nêu ở nút Xoá). Component dùng chung
// cho /companies/[companyId] và /contacts (mục 3), nhận dữ liệu qua props,
// không phụ thuộc trang cha.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContactForm, type ContactFormValues } from "@/components/contact-form";

export function EditContactDialog({
  companyId,
  companyName,
  contactId,
  initialValues,
}: {
  companyId: string;
  companyName: string;
  contactId: string;
  initialValues: ContactFormValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess(message: string) {
    setOpen(false);
    toast.success(message);
    // Server Action đã revalidatePath; refresh để bảng ở trang đang đứng
    // (Server Component) lấy dữ liệu mới mà không đổi URL/bộ lọc.
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Sửa
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sửa người liên hệ</DialogTitle>
            <DialogDescription>
              Thay đổi sẽ được ghi vào Lịch sử thao tác, kèm ghi chú lý do bên dưới.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            mode="edit"
            companyId={companyId}
            companyName={companyName}
            contactId={contactId}
            initialValues={initialValues}
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
