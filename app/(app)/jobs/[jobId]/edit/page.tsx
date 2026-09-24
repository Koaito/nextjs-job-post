// app/(app)/jobs/[jobId]/edit/page.tsx
// Tương đương add_job.html (nhánh sửa — route riêng jobs.edit(job_id)
// bên Flask, KHÔNG đi qua add_hub, xem plan Phần 3 mục "Nhóm 1 còn
// thiếu" #2: "/jobs/[jobId]/edit. Đây là route riêng, không đi qua
// /them-moi"). Dùng chung <JobForm> (components/job-form.tsx) ở
// mode="edit" — ô chọn công ty tự ẩn theo đúng quy tắc plan.
//
// requireStaff() — khớp comment sẵn có ở lib/auth-guard.ts:
// "/jobs/add và /jobs/[jobId]/edit vẫn requireStaff()".

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { getJob } from "@/lib/api/jobs";
import { getLevelCodes, getProvinceNames } from "@/lib/api/enums";
import { JobForm, type JobFormValues } from "@/components/job-form";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireStaff();
  const { jobId } = await params;

  const [job, levels, provinces] = await Promise.all([
    getJob(jobId),
    getLevelCodes(),
    getProvinceNames(),
  ]);
  if (!job) notFound();

  // Khớp toJobDetailData() ở lib/api/jobs.ts phần đọc parsed_content —
  // job nhập tay cũ có thể parsed_content = null hoàn toàn, không chỉ
  // thiếu từng key con, nên fallback rỗng ở object trước khi đọc key.
  const parsed = (job.parsed_content ?? {}) as {
    job_description?: string | null;
    requirements?: string | null;
    perks?: string | null;
    required_skills?: string[] | null;
  };

  const initialValues: JobFormValues = {
    jobTitle: job.job_title,
    matchingIndustry: job.matching_industry ?? "",
    levelCode: job.level_code ?? "",
    provinceName: job.province_name ?? "",
    workType: job.work_type ?? "",
    currency: job.currency ?? "VNĐ",
    salaryMin: job.salary_min != null ? String(job.salary_min) : "",
    salaryMax: job.salary_max != null ? String(job.salary_max) : "",
    salaryType: job.salary_type ?? "NEGOTIABLE",
    salaryPeriod: job.salary_period ?? "MONTH",
    deadline: job.deadline ?? "",
    skills: (parsed.required_skills ?? []).join(", "),
    description: parsed.job_description ?? "",
    requirements: parsed.requirements ?? "",
    benefits: parsed.perks ?? "",
    ssTeamNotes: job.ss_team_notes ?? "",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/jobs/${jobId}`} className="text-sm text-muted-foreground underline">
        ← Chi tiết job
      </Link>

      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Việc làm</span>
        <h1 className="font-heading text-2xl font-semibold">Sửa job</h1>
        <p className="mt-1 text-muted-foreground">Cập nhật thông tin job này.</p>
      </header>

      <JobForm
        mode="edit"
        jobId={jobId}
        initialValues={initialValues}
        levels={levels}
        provinces={provinces}
      />
    </div>
  );
}
