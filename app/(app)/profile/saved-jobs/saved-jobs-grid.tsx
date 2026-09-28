"use client";
// app/(app)/profile/saved-jobs/saved-jobs-grid.tsx
// Lưới card "Job đã lưu" — Nhóm 5, Đợt 5.2 của plan. Tương đương
// `data-remove-on-unsave="true"` trong saved_jobs.html (Flask): bấm
// "Bỏ lưu" thì card BIẾN MẤT khỏi danh sách ngay, không reload.
//
// Cách làm: danh sách job lấy từ server (props), nhưng card nào hiện hay ẩn
// do trạng thái "đã lưu" trong <SavedJobsProvider> quyết định (nút Bỏ lưu
// cập nhật lạc quan vào đó). Nhờ vậy:
//   - bỏ lưu -> card ẩn ngay;
//   - server action lỗi -> nút tự rollback trạng thái -> card hiện lại +
//     toast lỗi, không mất job oan.
// Bỏ lưu hết thì hiện empty state như Flask.
//
// ĐỒNG BỘ VỚI SERVER khi mở trang: <SavedJobsProvider> chỉ đọc danh sách
// "đã lưu" 1 lần lúc mount layout và giữ nguyên khi chuyển trang. Nếu học
// viên vừa lưu job ở tab khác, provider chưa biết -> lọc theo isSaved() sẽ
// ẩn nhầm card mà server đang trả về. Nên lần đầu (và mỗi khi props từ
// server đổi) ghi đè server-truth vào provider TRƯỚC, rồi mới bắt đầu lọc.

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobCard, JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import { buttonVariants } from "@/components/ui/button";
import { useSavedJobs } from "@/components/saved-jobs-provider";
import type { JobCardData } from "@/lib/api/jobs";

export function SavedJobsGrid({ jobs }: { jobs: JobCardData[] }) {
  const { isSaved, setSaved } = useSavedJobs();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    for (const job of jobs) setSaved(job.id, true);
    setSynced(true);
  }, [jobs, setSaved]);

  // Chưa đồng bộ xong thì hiện đủ danh sách server trả (khỏi nháy trống).
  const visible = synced ? jobs.filter((job) => isSaved(job.id)) : jobs;

  if (visible.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="mb-4 text-muted-foreground">Bạn chưa lưu job nào.</p>
        <Link href="/jobs" className={buttonVariants()}>
          Khám phá job ngay
        </Link>
      </div>
    );
  }

  return (
    <div className={JOB_GRID_CLASS}>
      {visible.map((job) => (
        <JobCard key={job.id} job={job} isAuthenticated saveVariant="saved-list" />
      ))}
    </div>
  );
}
