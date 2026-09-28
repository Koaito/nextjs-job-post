// app/(app)/profile/saved-jobs/page.tsx
// Tương đương saved_jobs.html + my_stuff.saved_jobs() (Flask) — "Job đã lưu".
// Nhóm 5, Đợt 5.2 của plan. Khung (tiêu đề "Trang cá nhân" + sub-nav) nằm ở
// profile/layout.tsx.
//
// CHỈ HỌC VIÊN: requireStudent() (staff -> /dashboard, khớp Flask). Plan
// cảnh báo đúng chỗ này: tài khoản vừa nâng lên ss_team còn dữ liệu saved_jobs
// cũ không được xem lại dù gõ thẳng URL — nên page tự guard, không dựa vào
// việc sidebar/sub-nav đã ẩn link.
//
// GET /me/saved-jobs chỉ trả job_id + vài field tóm tắt, còn card cần đủ
// ngành/level/lương/hạn/JD -> gọi getJob() từng job SONG SONG bằng
// Promise.all (Flask cũng song song hoá bằng _io_pool để tránh N+1 tuần tự,
// "load /saved-jobs 8.94s"). Job không lấy được (đã xoá) bị bỏ qua, không
// làm hỏng cả trang. force-dynamic: mọi lần vào đều thấy danh sách mới nhất.
//
// Card ẩn khi bỏ lưu: xem saved-jobs-grid.tsx.

import { requireStudent } from "@/lib/auth-guard";
import { getJob, toJobDetailData, type JobCardData } from "@/lib/api/jobs";
import { listMySavedJobs } from "@/lib/api/me";
import { SavedJobsGrid } from "./saved-jobs-grid";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  const user = await requireStudent();

  let errorMessage: string | null = null;
  let saved: Awaited<ReturnType<typeof listMySavedJobs>> = [];
  try {
    saved = await listMySavedJobs();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Không tải được danh sách job đã lưu.";
  }

  const rawJobs = await Promise.all(saved.map((s) => getJob(s.job_id)));

  // Chỉ chuyển đúng các field card cần sang Client Component (không kéo cả
  // mô tả/yêu cầu/quyền lợi của job vào payload).
  const jobs: JobCardData[] = [];
  for (const raw of rawJobs) {
    if (!raw) continue;
    const d = toJobDetailData(raw);
    jobs.push({
      id: d.id,
      position: d.position,
      company: d.company,
      companyId: d.companyId,
      industry: d.industry,
      level: d.level,
      location: d.location,
      workType: d.workType,
      statusLabel: d.statusLabel,
      statusRaw: d.statusRaw,
      salaryDisplay: d.salaryDisplay,
      deadline: d.deadline,
      source: d.source,
      jdLink: d.jdLink,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Job bạn đã lưu</h2>
        <p className="text-muted-foreground">
          Danh sách job {user.full_name} đã đánh dấu để theo dõi.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <SavedJobsGrid jobs={jobs} />
    </div>
  );
}
