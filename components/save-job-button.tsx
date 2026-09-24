"use client";

// components/save-job-button.tsx
// Tương đương .save-job-form (app.js) bên Flask — 1 form/JS dùng chung,
// đổi hành vi qua prop `variant` cho từng nơi khác nhau (plan dòng 947).
//
// Round này làm 2 biến thể: "card" (trang danh sách, chỉ đổi icon/label)
// và "detail" (trang chi tiết, đổi thêm cả màu nút primary/ghost). Biến
// thể thứ 3 plan có nhắc tới, "saved-list" (tự xoá hẳn card khỏi danh
// sách khi bỏ lưu), để dành cho trang "Job đã lưu" — thuộc Nhóm 5, CHƯA
// làm ở đây, không thêm code cho case chưa cần.
//
// Trạng thái "đã lưu" KHÔNG còn là prop `initialSaved` từng nơi tự fetch
// — đọc từ <SavedJobsProvider> ở app/(app)/layout.tsx (Round 5, plan
// Phần 2 mục 5). Cập nhật LẠC QUAN: đổi state trong Provider ngay khi
// bấm (mọi nơi hiện cùng job này đổi theo), gọi server action ở nền, đổi
// ngược lại + toast lỗi nếu action thất bại.

import { useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useSavedJobs } from "@/components/saved-jobs-provider";
import { toggleSaveJobAction } from "@/lib/actions/job-actions";

interface SaveJobButtonProps {
  jobId: string;
  variant?: "card" | "detail";
  /** Staff KHÔNG được lưu job (job_detail.html chỉ hiện aside Lưu/Ứng
   *  tuyển cho học viên) — nơi gọi tự quyết định ẩn hẳn component này ở
   *  biến thể "detail" cho staff. Ở biến thể "card", backend tự chặn +
   *  trả lỗi tại chỗ (khớp _job_card.html vẫn hiện nút cho mọi role),
   *  nên KHÔNG tự ẩn ở đây theo `disabled` — chỉ dùng field này để đổi
   *  label/tooltip cho rõ nếu staff lỡ bấm. */
  disabledReason?: string;
}

export function SaveJobButton({
  jobId,
  variant = "card",
  disabledReason,
}: SaveJobButtonProps) {
  const { isSaved, setSaved } = useSavedJobs();
  const [isPending, startTransition] = useTransition();
  const saved = isSaved(jobId);

  function handleClick() {
    const previous = saved;
    setSaved(jobId, !previous); // lạc quan: đổi UI ngay, chưa đợi server
    startTransition(async () => {
      const result = await toggleSaveJobAction(jobId);
      if (!result.ok) {
        setSaved(jobId, previous); // rollback về giá trị trước khi bấm
        toast.error(result.errorMessage ?? "Không thể lưu job lúc này.");
        return;
      }
      // Server là nguồn sự thật: nếu trạng thái thật khác dự đoán lạc quan
      // (vd job đã được lưu/bỏ lưu từ tab khác), lấy theo server.
      if (typeof result.saved === "boolean") setSaved(jobId, result.saved);
    });
  }

  const label = saved ? "Đã lưu" : "Lưu job";
  const Icon = saved ? BookmarkCheck : Bookmark;

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant={saved ? "secondary" : "default"}
        className="w-full"
        disabled={isPending}
        onClick={handleClick}
        title={disabledReason}
      >
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  // variant === "card": chỉ đổi icon/label, không đổi màu nút primary —
  // khớp _job_card.html (nút nhỏ góc card, không phải CTA chính).
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={handleClick}
      title={disabledReason ?? label}
      aria-label={label}
      className={cn(saved && "text-primary")}
    >
      <Icon className="size-4" />
    </Button>
  );
}
