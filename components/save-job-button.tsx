"use client";

// components/save-job-button.tsx
// Tương đương .save-job-form (app.js) bên Flask — 1 form/JS dùng chung,
// đổi hành vi qua prop `variant` cho từng nơi khác nhau (plan dòng 947).
//
// 3 biến thể: "card" (trang danh sách, chỉ đổi icon/label), "detail" (trang
// chi tiết, đổi thêm cả màu nút primary/ghost) và "saved-list" (trang "Job đã
// lưu" — Nhóm 5 Đợt 5.2: luôn hiện "🔖 Bỏ lưu"; card tự biến mất khỏi danh
// sách khi bỏ lưu vì <SavedJobsGrid> lọc theo trạng thái trong Provider, khớp
// data-remove-on-unsave của saved_jobs.html).
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
import { SAVE_BTN_CLASS, SAVE_BTN_SAVED_CLASS } from "@/components/save-btn-style";
import { toggleSaveJobAction } from "@/lib/actions/job-actions";

interface SaveJobButtonProps {
  jobId: string;
  variant?: "card" | "detail" | "saved-list";
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
      // Ở danh sách "Job đã lưu" card biến mất ngay -> cần 1 toast để người
      // dùng biết thao tác đã thành công (Flask: flash "Đã bỏ lưu job.").
      if (variant === "saved-list" && result.saved === false) toast.success("Đã bỏ lưu job.");
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

  // variant === "saved-list": luôn là nút "Bỏ lưu" (job trong danh sách này
  // vốn đã lưu) — cùng kiểu chữ nhỏ + tô cam như card đã lưu.
  if (variant === "saved-list") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        title={disabledReason}
        className={cn(SAVE_BTN_CLASS, SAVE_BTN_SAVED_CLASS)}
      >
        🔖 Bỏ lưu
      </button>
    );
  }

  // variant === "card": nút chữ nhỏ trong hàng thao tác cuối card, nằm
  // cạnh "Xem JD gốc ↗" — đúng `.save-btn` của _job_card.html (chỉ đổi
  // nhãn 🔖 Lưu job <-> 🔖 Đã lưu + tô cam khi đã lưu, không phải CTA
  // chính). Bản trước vẽ icon-only ở góc trên card nên lệch Flask.
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      title={disabledReason}
      className={cn(SAVE_BTN_CLASS, saved && SAVE_BTN_SAVED_CLASS)}
    >
      🔖 {label}
    </button>
  );
}
