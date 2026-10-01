// app/(app)/student-activity/[id]/page.tsx
// Tương đương student_activity_detail.html + blueprints/students.py::
// activity_detail() (Flask) — job 1 học viên đã ỨNG TUYỂN và đã LƯU.
// Nhóm 3, Đợt 3.3, Phần 3/4.
//
// CHỈ STAFF: requireStaff(). id không phải học viên (không tồn tại, hoặc
// là staff) -> 404 ở tầng route. Khác Flask (redirect về danh sách kèm
// flash) — cùng cách xử lý /staff-accounts/add: Next.js trả 404 thay cho
// redirect+flash.
// Lỗi tải dữ liệu -> banner lỗi tại chỗ (không 404, không redirect), và 2
// danh sách (ứng tuyển / đã lưu) tải độc lập bằng Promise.allSettled: 1
// bên lỗi không làm mất bên còn lại.
// Không phân trang (plan Nhóm 3): render toàn bộ 2 danh sách.
//
// Nút "Tải CV ứng tuyển" trỏ GET /students/cv/<application_id> (Route
// Handler, Phần 4/4), mở tab mới target="_blank" rel="noopener". Dùng
// <a> thường, KHÔNG dùng <Link>: tránh Next prefetch gọi route redirect
// này khi card hiện ra trên màn hình.
// force-dynamic: staff cần thấy ứng tuyển/lưu mới nhất của học viên.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { listAllUsers, type StaffUser } from "@/lib/api/auth";
import {
  listApplicationsOfUser,
  listSavedJobsOfUser,
  type JobApplicationOut,
  type SavedJobOut,
} from "@/lib/api/applications";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import { buttonVariants } from "@/components/ui/button";
import { JOB_STATUS_LABELS } from "@/lib/constants";
import { formatDateVN } from "@/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động học viên — MindX Career Hub",
};

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

/** Dải stub của card: mã job + chip trạng thái (khớp ticket-stub bên Flask
 *  và profile/applications/page.tsx). */
function CardStub({ jobId, jobStatus }: { jobId: string; jobStatus?: string | null }) {
  const statusRaw = jobStatus ?? "";
  const statusLabel = JOB_STATUS_LABELS[statusRaw] || statusRaw;
  return (
    <div className="flex items-center gap-2.5 border-b border-dashed border-border bg-[#FAFBFA] px-4 py-2.5">
      <span className="mr-auto font-mono text-[11.5px] text-muted-foreground">
        JOB-{jobId.slice(0, 8).toUpperCase()}
      </span>
      {statusRaw && (
        <span
          className={
            "shrink-0 rounded-full px-[9px] py-1 text-[11px] font-semibold whitespace-nowrap " +
            (statusRaw === "OPEN"
              ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
              : "bg-[#EDEFEC] text-muted-foreground")
          }
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}

const CARD_CLASS =
  "flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card";

export default async function StudentActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  let users: StaffUser[] = [];
  let error: string | null = null;
  try {
    users = await listAllUsers();
  } catch (err) {
    error = errorMessage(err, "Đã có lỗi khi tải thông tin học viên.");
  }

  // Không tải được danh sách user: KHÔNG kết luận "không có học viên này"
  // — hiện lỗi thật để khỏi nhầm với id sai.
  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/student-activity" className="text-sm underline">
          ← Hoạt động học viên
        </Link>
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  const student = users.find((u) => u.ss_user_id === id && u.role === "user");
  if (!student) notFound();

  const [appsRes, savedRes] = await Promise.allSettled([
    listApplicationsOfUser(student.ss_user_id),
    listSavedJobsOfUser(student.ss_user_id),
  ]);

  const errors: string[] = [];
  const applications: JobApplicationOut[] = appsRes.status === "fulfilled" ? appsRes.value : [];
  if (appsRes.status === "rejected") {
    errors.push(errorMessage(appsRes.reason, "Đã có lỗi khi tải danh sách job đã ứng tuyển."));
  }
  const savedJobs: SavedJobOut[] = savedRes.status === "fulfilled" ? savedRes.value : [];
  if (savedRes.status === "rejected") {
    errors.push(errorMessage(savedRes.reason, "Đã có lỗi khi tải danh sách job đã lưu."));
  }

  const lede = [student.email, student.phone, student.track].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <Link href="/student-activity" className="text-sm underline">
        ← Hoạt động học viên
      </Link>

      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị / Hoạt động học viên</span>
        <h1 className="font-heading text-3xl font-semibold">{student.full_name}</h1>
        <p className="mt-1 text-muted-foreground">{lede}</p>
      </header>

      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <dl className="grid grid-cols-2 gap-4 rounded-md border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Đã ứng tuyển</dt>
          <dd className="text-2xl font-semibold">{applications.length} job</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Đã lưu</dt>
          <dd className="text-2xl font-semibold">{savedJobs.length} job</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Ngày đăng ký</dt>
          <dd className="text-2xl font-semibold">{formatDateVN(student.created_at)}</dd>
        </div>
      </dl>

      {/* --- Đã ứng tuyển --- */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">📨 Đã ứng tuyển ({applications.length})</h2>
        {applications.length > 0 ? (
          <div className={JOB_GRID_CLASS}>
            {applications.map((a) => (
              <article key={a.application_id} className={CARD_CLASS}>
                <CardStub jobId={a.job_id} jobStatus={a.job_status} />
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <h3 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
                    <Link href={`/jobs/${a.job_id}`} className="hover:text-primary">
                      {a.job_title}
                    </Link>
                  </h3>
                  <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">{a.company_name}</p>
                  {a.note && (
                    // Text thuần (JSX tự escape) — ghi chú do học viên nhập.
                    <p className="m-0 text-sm text-muted-foreground">Ghi chú của học viên: {a.note}</p>
                  )}
                  <div className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>📨 Đã ứng tuyển: {formatDateVN(a.applied_at)}</span>
                  </div>
                  {a.cv_url ? (
                    <a
                      href={`/students/cv/${a.application_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full"}
                    >
                      📄 Tải CV ứng tuyển
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">(Chưa có file CV)</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
            Học viên này chưa ứng tuyển job nào.
          </div>
        )}
      </section>

      {/* --- Đã lưu --- */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">🔖 Đã lưu ({savedJobs.length})</h2>
        {savedJobs.length > 0 ? (
          <div className={JOB_GRID_CLASS}>
            {savedJobs.map((s) => (
              <article key={s.saved_job_id} className={CARD_CLASS}>
                <CardStub jobId={s.job_id} jobStatus={s.job_status} />
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <h3 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
                    <Link href={`/jobs/${s.job_id}`} className="hover:text-primary">
                      {s.job_title}
                    </Link>
                  </h3>
                  <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">{s.company_name}</p>
                  <div className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>🔖 Đã lưu: {formatDateVN(s.created_at)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
            Học viên này chưa lưu job nào.
          </div>
        )}
      </section>
    </div>
  );
}
