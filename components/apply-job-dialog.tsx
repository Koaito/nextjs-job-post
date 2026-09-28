"use client";
// components/apply-job-dialog.tsx
// Nút "📨 Ứng tuyển ngay" + hộp thoại nộp CV — Nhóm 5, Đợt 5.3 của plan.
// Tương đương #applyCvModal trong job_detail.html (Flask): chọn file CV
// (.pdf, tối đa 5MB, bắt buộc) + ghi chú gửi Team SS (không bắt buộc).
//
// Gửi bằng fetch multipart tới Route Handler /api/applications (không phải
// Server Action — upload 5MB, xem comment ở app/api/applications/route.ts).
// KHÔNG tự đặt header Content-Type: trình duyệt phải tự sinh boundary.
//
// Kiểm tra sớm phía client (đúng .pdf, ≤ 5MB) để khỏi upload vô ích; server
// vẫn kiểm tra lại. Riêng 413: Vercel có thể chặn body > ~4.5MB trước cả
// khi vào Route Handler (plan Phụ lục B) — khi đó response không phải JSON,
// hiện thông báo riêng thay vì "lỗi không xác định".

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_CV_BYTES = 5 * 1024 * 1024;

export function ApplyJobDialog({
  jobId,
  jobTitle,
  companyName,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Đổi key để <input type="file"> được dựng lại (xoá file đã chọn) khi
  // đóng/mở dialog — input file không điều khiển được bằng value.
  const [fileInputKey, setFileInputKey] = useState(0);

  function reset() {
    setFile(null);
    setNote("");
    setError(null);
    setFileInputKey((k) => k + 1);
  }

  function handleOpenChange(next: boolean) {
    if (!next && pending) return; // đang upload dở thì không cho đóng ngang
    if (!next) reset();
    setOpen(next);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Vui lòng đính kèm file CV (.pdf) khi ứng tuyển.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Chỉ chấp nhận file CV định dạng PDF (.pdf).");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setError("File CV không được vượt quá 5MB.");
      return;
    }

    const form = new FormData();
    form.append("job_id", jobId);
    form.append("cv_file", file, file.name);
    if (note.trim()) form.append("note", note.trim());

    setPending(true);
    try {
      const res = await fetch("/api/applications", { method: "POST", body: form });

      let data: { ok?: boolean; message?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!data) {
        setError(
          res.status === 413
            ? "File CV quá lớn so với giới hạn tải lên của máy chủ. Vui lòng nén nhỏ file CV lại rồi thử lại."
            : "Không thể nộp hồ sơ lúc này, vui lòng thử lại sau.",
        );
        return;
      }
      if (!data.ok) {
        setError(data.message ?? "Không thể nộp hồ sơ lúc này, vui lòng thử lại sau.");
        return;
      }

      // Cả nộp mới lẫn "đã ứng tuyển rồi" (409) đều là toast thành công.
      toast.success(data.message ?? "Đã ghi nhận ứng tuyển.");
      setOpen(false);
      reset();
      router.refresh(); // trang chi tiết đọc lại -> nút chuyển sang "Đã ứng tuyển"
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        <Send />
        Ứng tuyển ngay
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nộp hồ sơ ứng tuyển</DialogTitle>
              <DialogDescription>
                Vị trí: <strong>{jobTitle}</strong> — {companyName}
              </DialogDescription>
            </DialogHeader>

            <div>
              <label htmlFor="apply-cv" className="block text-sm font-medium">
                File CV của bạn (PDF) <span className="text-destructive">*</span>
              </label>
              <input
                key={fileInputKey}
                id="apply-cv"
                type="file"
                accept=".pdf,application/pdf"
                required
                disabled={pending}
                onChange={handleFileChange}
                className="mt-1.5 w-full text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Định dạng .pdf, dung lượng tối đa 5MB.</p>
            </div>

            <div>
              <label htmlFor="apply-note" className="block text-sm font-medium">
                Ghi chú gửi Team SS (không bắt buộc)
              </label>
              <textarea
                id="apply-note"
                rows={3}
                disabled={pending}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kinh nghiệm nổi bật, định hướng cá nhân..."
                className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang nộp…" : "Xác nhận nộp CV"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
