"use client";

// app/(app)/jobs/[jobId]/job-status-panel.tsx
// Tương đương khối "Cập nhật trạng thái" (staff) trong job_detail.html
// + 2 modal #jobStatusModal / #jobDeleteModal. Chỉ được render ở nhánh
// staff của page.tsx — component này KHÔNG tự check quyền (backend vẫn
// chặn ở PATCH /jobs/{id}, đúng nguyên tắc "check quyền ở guard/page,
// không rải rác từng component" của plan).
//
// Đúng plan Nhóm 1 (dòng "Đổi trạng thái job và các thao tác ghi audit
// log..."): luồng "thu note trước -> gọi server action -> cập nhật UI
// khi thành công". KHÔNG useOptimistic, KHÔNG toast "Hoàn tác" — lý do
// phải nhập TRƯỚC khi hành động xảy ra. Note của job là TUỲ CHỌN
// (noteRequired=false), khác note bắt buộc của Company/Contact.
//
// Không có DELETE thật cho Job ở backend: "Đóng job" chỉ là
// PATCH job_status=CLOSED (xem lib/api/jobs.ts::updateJobStatus).

import { useState } from "react";
import Link from "next/link";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { JOB_STATUS_LABELS } from "@/lib/constants";
import { updateJobStatusAction } from "@/lib/actions/job-actions";

type JobStatus = "OPEN" | "CLOSED";
type DialogKind = "status" | "close" | null;

function isJobStatus(value: string): value is JobStatus {
  return value === "OPEN" || value === "CLOSED";
}

export function JobStatusPanel({
  jobId,
  position,
  statusRaw,
}: {
  jobId: string;
  position: string;
  statusRaw: string;
}) {
  // null = đang theo giá trị thật từ server (statusRaw). Chỉ giữ giá
  // trị riêng khi staff đang chọn dở trong <select>; sau khi action
  // thành công thì reset về null để <select> tự theo statusRaw mới mà
  // page.tsx nhận lại sau revalidatePath — không cần useEffect đồng bộ.
  const [picked, setPicked] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = picked ?? statusRaw;
  const canSaveStatus = isJobStatus(selected) && selected !== statusRaw;
  const alreadyClosed = statusRaw === "CLOSED";

  async function submit(status: JobStatus, note: string) {
    const result = await updateJobStatusAction(jobId, status, note || undefined);
    if (!result.ok) {
      return {
        ok: false,
        message: result.errorMessage ?? "Không thể cập nhật trạng thái job.",
      };
    }
    setPicked(null);
    setNotice(
      status === "CLOSED"
        ? "Đã đóng job."
        : `Đã đổi trạng thái sang "${JOB_STATUS_LABELS[status] ?? status}".`,
    );
    return { ok: true, message: "" };
  }

  return (
    <section className="rounded-md border p-4">
      <h4 className="font-heading font-semibold">Cập nhật trạng thái</h4>

      <div className="mt-2 flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => {
            setNotice(null);
            setPicked(e.target.value);
          }}
          aria-label="Trạng thái job"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
        >
          {Object.entries(JOB_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={!canSaveStatus}
          onClick={() => {
            setNotice(null);
            setDialog("status");
          }}
        >
          Lưu
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* /jobs/[jobId]/edit thuộc "Nhóm 1 phần 3b" (JobForm) — chưa
            tồn tại ở round này, link sẽ ra 404 tới khi làm xong phần đó. */}
        <Link href={`/jobs/${jobId}/edit`} className={buttonVariants({ variant: "outline" })}>
          Sửa thông tin job
        </Link>
        <Button
          type="button"
          variant="destructive"
          disabled={alreadyClosed}
          title={alreadyClosed ? "Job này đã đóng" : undefined}
          onClick={() => {
            setNotice(null);
            setDialog("close");
          }}
        >
          Đóng job
        </Button>
      </div>

      {notice && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <NoteConfirmDialog
        open={dialog === "status"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Cập nhật trạng thái job"
        description={
          <>
            Đổi &ldquo;{position}&rdquo; sang{" "}
            <strong>{JOB_STATUS_LABELS[selected] ?? selected}</strong>.
          </>
        }
        noteLabel="Lý do thay đổi (không bắt buộc)"
        notePlaceholder="Lý do thay đổi trạng thái…"
        confirmLabel="Cập nhật"
        onConfirm={(note) => {
          // canSaveStatus đã đảm bảo selected là JobStatus khi mở dialog
          return submit(isJobStatus(selected) ? selected : "OPEN", note);
        }}
      />

      <NoteConfirmDialog
        open={dialog === "close"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Đóng job"
        description={
          <>
            Job &ldquo;{position}&rdquo; sẽ chuyển sang <strong>Đã đóng</strong>. Job vẫn còn
            trong hệ thống nên sẽ không bị crawl lại tạo trùng.
          </>
        }
        noteLabel="Lý do đóng job (không bắt buộc)"
        notePlaceholder="Nhập lý do đóng job này…"
        confirmLabel="Đóng job"
        danger
        onConfirm={(note) => submit("CLOSED", note)}
      />
    </section>
  );
}
