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
// ẩn nhầm card mà server đang trả về trong 1 nhịp render đầu, tới khi effect
// dưới đây chạy xong (đồng bộ provider) thì context đổi -> component này tự
// render lại -> card hiện đúng lại ngay. Chấp nhận độ trễ 1 khung hình ở
// đúng trường hợp hiếm này, đổi lại KHÔNG cần thêm state cục bộ nào để
// theo dõi "đã đồng bộ xong chưa" — bản trước dùng useState/useRef riêng
// cho việc này đều bị react-hooks (set-state-in-effect / refs) báo lỗi:
// set state ngay trong effect thì bị coi là dễ gây render dồn; còn đọc
// ref.current lúc render thì compiler không đảm bảo component được render
// lại đúng lúc ref đổi. Bỏ hẳn state trung gian là cách đơn giản nhất
// tương thích cả 2 rule, ở trường hợp thường gặp (provider vốn đã khớp
// `jobs` ngay từ lần render đầu — layout và trang này lấy dữ liệu gần như
// cùng lúc trong cùng 1 request) thì không có gì khác biệt.

import { useEffect } from "react";
import Link from "next/link";
import { JobCard, JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import { buttonVariants } from "@/components/ui/button";
import { useSavedJobs } from "@/components/saved-jobs-provider";
import type { JobCardData } from "@/lib/api/jobs";

export function SavedJobsGrid({ jobs }: { jobs: JobCardData[] }) {
  const { isSaved, setSaved } = useSavedJobs();

  // Đồng bộ 1 HỆ THỐNG NGOÀI (provider dùng chung toàn app) với server-truth
  // của trang này — đúng việc effect nên làm, không phải state cục bộ.
  useEffect(() => {
    for (const job of jobs) setSaved(job.id, true);
  }, [jobs, setSaved]);

  const visible = jobs.filter((job) => isSaved(job.id));

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
