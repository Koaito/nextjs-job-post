"use client";
// components/contact-cells.tsx
// 2 cell "đổi tại chỗ" của contact — Nhóm 2, Phần 2, mục 3 của plan:
//   - <ContactStatusCell>  ← _contact_status_cell.html  (dùng ở /contacts và
//                            /companies/[companyId])
//   - <ContactAssignCell>  ← _contact_assign_cell.html  (dùng ở /contacts;
//                            plan Nhóm 3 dòng 1012: sau này dùng lại nguyên
//                            ở /staff-activity/[id])
// Viết thành Client Component DÙNG CHUNG thật sự: chỉ nhận dữ liệu qua props,
// tự gọi server action, không biết trang cha là trang nào.
//
// Luồng theo plan (dòng 980, 993): "thu note trước → gọi server action →
// cập nhật UI khi thành công". KHÔNG useOptimistic (lý do phải nhập TRƯỚC khi
// hành động xảy ra, không có cách thu lại sau khi hoàn tác). Note chỉ BẮT
// BUỘC khi giá trị thật sự đổi (cải tiến so với Flask luôn `required`); không
// đổi thì nút Lưu bị khoá — khỏi gọi API vô ích.
//
// Dùng <Dialog> thay <details> popover của Flask: bảng /contacts nằm trong
// wrapper overflow-x-auto nên popover absolute ở các dòng cuối bị cắt/che.
// Dialog vẫn "tại chỗ" (không reload, không điều hướng), chỉ khác ở chỗ hiện
// giữa màn hình. Note tự .trim() (plan dòng 192).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONTACT_STATUS_CODES, CONTACT_STATUS_LABELS } from "@/lib/constants";
import { assignContactAction, updateContactStatusAction } from "@/lib/actions/contact-actions";

interface Option {
  value: string;
  label: string;
}

interface QuickEditCellProps {
  triggerLabel: string;
  triggerTitle: string;
  dialogTitle: string;
  dialogDescription: string;
  selectLabel: string;
  notePlaceholder: string;
  options: Option[];
  current: string;
  onSave: (value: string, note: string) => Promise<{ ok: boolean; message: string }>;
}

const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

function QuickEditCell({
  triggerLabel,
  triggerTitle,
  dialogTitle,
  dialogDescription,
  selectLabel,
  notePlaceholder,
  options,
  current,
  onSave,
}: QuickEditCellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const changed = value !== current;
  const trimmedNote = note.trim();
  const canSave = changed && trimmedNote.length > 0 && !pending;

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) {
      // Mở lại luôn bắt đầu từ giá trị HIỆN TẠI của server (props có thể đã
      // đổi sau refresh) — không giữ lại lựa chọn dở dang của lần trước.
      setValue(current);
      setNote("");
      setError(null);
    }
    setOpen(next);
  }

  async function handleSave() {
    if (!canSave) return;
    setPending(true);
    setError(null);
    const result = await onSave(value, trimmedNote);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    toast.success(result.message);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        title={triggerTitle}
        onClick={() => handleOpenChange(true)}
        className="rounded-md px-1.5 py-0.5 text-left underline decoration-dotted underline-offset-4 hover:bg-muted"
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{selectLabel}</label>
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={pending}
                className={selectClass}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Ghi chú lý do {changed ? <span className="text-destructive">*</span> : null}
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={pending}
                placeholder={changed ? notePlaceholder : "Chọn giá trị khác để thay đổi…"}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContactStatusCell({
  companyId,
  contactId,
  status,
}: {
  companyId: string;
  contactId: string;
  /** Mã backend (UNCONTACTED | EMAIL_SENT | RESPONDED | IN_PARTNERSHIP). */
  status: string;
}) {
  const options: Option[] = CONTACT_STATUS_CODES.map((code) => ({
    value: code,
    label: CONTACT_STATUS_LABELS[code] ?? code,
  }));
  // Mã lạ (backend thêm trạng thái mới) vẫn phải hiện đúng trong <select>,
  // không rơi về option đầu tiên như thể contact đang ở trạng thái khác.
  if (!options.some((o) => o.value === status)) {
    options.push({ value: status, label: CONTACT_STATUS_LABELS[status] ?? status });
  }

  return (
    <QuickEditCell
      triggerLabel={CONTACT_STATUS_LABELS[status] ?? status}
      triggerTitle="Bấm để đổi trạng thái"
      dialogTitle="Đổi trạng thái liên hệ"
      dialogDescription="Thay đổi được ghi vào Lịch sử thao tác, kèm ghi chú lý do."
      selectLabel="Trạng thái"
      notePlaceholder="Lý do đổi trạng thái…"
      options={options}
      current={status}
      onSave={(value, note) => updateContactStatusAction(companyId, contactId, value, note)}
    />
  );
}

export interface AssigneeOption {
  id: string;
  name: string;
}

export function ContactAssignCell({
  companyId,
  contactId,
  assigneeId,
  staff,
}: {
  companyId: string;
  contactId: string;
  /** ss_user_id đang phụ trách; null/"" = chưa gán. */
  assigneeId: string | null;
  /** Nhân sự ss_team/admin cho dropdown — nơi gọi tự load 1 lần rồi truyền. */
  staff: AssigneeOption[];
}) {
  const current = assigneeId ?? "";
  const options: Option[] = [
    { value: "", label: "— Chưa gán —" },
    ...staff.map((u) => ({ value: u.id, label: u.name })),
  ];
  // Người đang phụ trách không còn trong danh sách nhân sự (vd đã bị vô hiệu
  // hoá): thêm option riêng để <select> không hiện nhầm "Chưa gán".
  const known = staff.find((u) => u.id === current);
  if (current && !known) options.push({ value: current, label: "Đã gán (không rõ tên)" });

  const label = current ? (known?.name ?? "Đã gán (không rõ tên)") : "— Chưa gán —";

  return (
    <QuickEditCell
      triggerLabel={label}
      triggerTitle="Bấm để gán / đổi người phụ trách"
      dialogTitle="Đổi người phụ trách"
      dialogDescription="Chọn “Chưa gán” để bỏ gán. Thay đổi được ghi vào Lịch sử thao tác."
      selectLabel="Người phụ trách"
      notePlaceholder="Lý do gán / đổi / bỏ gán…"
      options={options}
      current={current}
      onSave={(value, note) => assignContactAction(companyId, contactId, value, note)}
    />
  );
}
