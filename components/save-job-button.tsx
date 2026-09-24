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
// useOptimistic (không phải useState) đúng theo plan: save/unsave job
// là thao tác nhỏ, làm đi làm lại nhiều lần, không bắt buộc lý do — cập
// nhật UI ngay khi bấm, gọi server action ở nền, rollback nếu lỗi.

import { useOptimistic, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { toggleSaveJobAction } from "@/lib/actions/job-actions";

interface SaveJobButtonProps {
  jobId: string;
  initialSaved: boolean;
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
  initialSaved,
  variant = "card",
  disabledReason,
}: SaveJobButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(initialSaved);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    setErrorMessage(null);
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      const result = await toggleSaveJobAction(jobId);
      if (!result.ok) {
        // useOptimistic tự rollback về giá trị thật (initialSaved) khi
        // startTransition kết thúc mà không có update mới nào further —
        // hiện thêm message lỗi để người dùng biết vì sao icon nhảy lại.
        setErrorMessage(result.errorMessage ?? "Không thể lưu job lúc này.");
      }
    });
  }

  const label = optimisticSaved ? "Đã lưu" : "Lưu job";
  const Icon = optimisticSaved ? BookmarkCheck : Bookmark;

  if (variant === "detail") {
    return (
      <div>
        <Button
          type="button"
          variant={optimisticSaved ? "secondary" : "default"}
          className="w-full"
          disabled={isPending}
          onClick={handleClick}
          title={disabledReason}
        >
          <Icon className="size-4" />
          {label}
        </Button>
        {errorMessage && (
          <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>
        )}
      </div>
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
      title={errorMessage ?? disabledReason ?? label}
      aria-label={label}
      className={cn(optimisticSaved && "text-primary")}
    >
      <Icon className="size-4" />
    </Button>
  );
}
