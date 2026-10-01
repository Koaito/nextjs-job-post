// components/staff-activity-view.tsx
// Phần THÂN dùng chung của "hoạt động của 1 thành viên team SS": cụm thống
// kê 4 số + 4 danh sách (job/công ty/contact tự tạo + contact đang phụ
// trách). Tách từ app/(app)/profile/activity/page.tsx (Nhóm 3, Đợt 3.3,
// Phần 1/4) để 2 nơi dùng chung 1 bản thay vì viết trùng:
//   - /profile/activity     -> subject="self"  (ssUserId = chính mình)
//   - /staff-activity/[id]  -> subject="other" (ssUserId = người được xem)
// Plan Nhóm 3: 2 trang cùng 1 dữ liệu nên chỉ khác câu chữ ở trạng thái
// rỗng ("Bạn ..." / "Thành viên này ...") và phần đầu trang (tiêu đề, thông
// tin tài khoản) — phần đầu do TRANG tự dựng, component này không vẽ.
//
// Server Component bất đồng bộ, TRẢ FRAGMENT: các khối là con trực tiếp
// của <div className="space-y-6"> ở trang gọi, DOM y hệt bản cũ.
//
// 4 lệnh gọi ĐỘC LẬP chạy song song bằng Promise.allSettled (khớp cách
// profile.py song song hoá bằng ThreadPoolExecutor bên Flask) — 1 lệnh
// lỗi không kéo sập 3 lệnh còn lại, lỗi hiện thành banner phía trên.
//
// Card job khớp _job_card.html/staff_activity_detail.html bên Flask: dải
// stub có mã job + chip ngành + chip level (chỉ hiện khi có giá trị, khác
// JobCard ở /jobs vốn luôn hiện chip ngành "Chưa xác định"); chip trạng
// thái nằm cạnh tiêu đề (ticket-top), không nằm trong stub.
//
// `accountCreatedAt` (tuỳ chọn): khớp staff_activity_detail.html — dòng
// "Ngày tạo tài khoản" nằm cùng card với 4 số thống kê (dl thứ 2). Không
// truyền (vd /profile/activity) thì không hiện dòng này.
//
// `staff` (tuỳ chọn): trang gọi đã có sẵn danh sách staff thì truyền vào
// để khỏi gọi GET /auth/users lần nữa (vd /staff-activity/[id] đã tải
// toàn bộ user để tìm người được xem).

import Link from "next/link";
import { listAllJobsCreatedBy, toJobCardData } from "@/lib/api/jobs";
import { listAllCompaniesCreatedBy } from "@/lib/api/companies";
import { listAllContacts, type CompanyContactWithCompanyOut } from "@/lib/api/contacts";
import { listStaffUsers, type StaffUser } from "@/lib/api/auth";
import { ContactAssignCell } from "@/components/contact-cells";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import {
  PARTNERSHIP_POTENTIAL_LABELS,
  CONTACT_STATUS_LABELS,
  INDUSTRY_BADGE_STYLES,
  INDUSTRY_BADGE_FALLBACK,
} from "@/lib/constants";
import { formatDateVN } from "@/lib/date";

export type StaffActivitySubject = "self" | "other";

const EMPTY: Record<
  StaffActivitySubject,
  { jobs: string; companies: string; contactsCreated: string; contactsAssigned: string }
> = {
  self: {
    jobs: "Bạn chưa tự thêm job nào.",
    companies: "Bạn chưa tự thêm công ty nào.",
    contactsCreated: "Bạn chưa tự thêm contact nào.",
    contactsAssigned: "Bạn chưa được giao phụ trách contact nào.",
  },
  other: {
    jobs: "Thành viên này chưa tự thêm job nào.",
    companies: "Thành viên này chưa tự thêm công ty nào.",
    contactsCreated: "Thành viên này chưa tự thêm contact nào.",
    contactsAssigned: "Thành viên này chưa được giao phụ trách contact nào.",
  },
};

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

export async function StaffActivityView({
  ssUserId,
  subject,
  staff: staffPreloaded,
  accountCreatedAt,
}: {
  ssUserId: string;
  subject: StaffActivitySubject;
  staff?: StaffUser[];
  accountCreatedAt?: string | null;
}) {
  const [jobsRes, companiesRes, contactsCreatedRes, contactsAssignedRes, staffRes] =
    await Promise.allSettled([
      listAllJobsCreatedBy(ssUserId),
      listAllCompaniesCreatedBy(ssUserId),
      listAllContacts({ created_by: ssUserId }),
      listAllContacts({ assigned_ss_user: ssUserId }),
      staffPreloaded ? Promise.resolve(staffPreloaded) : listStaffUsers(),
    ]);

  const errors: string[] = [];
  const jobsCreated = jobsRes.status === "fulfilled" ? jobsRes.value : [];
  if (jobsRes.status === "rejected") errors.push(errorMessage(jobsRes.reason));

  const companiesCreated = companiesRes.status === "fulfilled" ? companiesRes.value : [];
  if (companiesRes.status === "rejected") errors.push(errorMessage(companiesRes.reason));

  const contactsCreated: CompanyContactWithCompanyOut[] =
    contactsCreatedRes.status === "fulfilled" ? contactsCreatedRes.value : [];
  if (contactsCreatedRes.status === "rejected") errors.push(errorMessage(contactsCreatedRes.reason));

  const contactsAssigned: CompanyContactWithCompanyOut[] =
    contactsAssignedRes.status === "fulfilled" ? contactsAssignedRes.value : [];
  if (contactsAssignedRes.status === "rejected") errors.push(errorMessage(contactsAssignedRes.reason));

  const staff = staffRes.status === "fulfilled" ? staffRes.value : [];
  if (staffRes.status === "rejected") errors.push(errorMessage(staffRes.reason));
  const assignees = staff.map((u) => ({ id: u.ss_user_id, name: u.full_name }));
  // Map ngược ss_user_id -> tên, dùng cho cột "Người tạo" ở bảng "Contact
  // đang phụ trách" (created_by luôn là 1 thành viên staff — người tạo
  // contact không bao giờ là học viên, xem contacts.py::create_contact()).
  const staffById = new Map(staff.map((u) => [u.ss_user_id, u.full_name]));

  return (
    <>
      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <div className="space-y-3 rounded-md border p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Job đã tạo</dt>
            <dd className="text-2xl font-semibold">{jobsCreated.length}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Công ty đã tạo</dt>
            <dd className="text-2xl font-semibold">{companiesCreated.length}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Contact đã tạo</dt>
            <dd className="text-2xl font-semibold">{contactsCreated.length}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Contact đang phụ trách</dt>
            <dd className="text-2xl font-semibold">{contactsAssigned.length}</dd>
          </div>
        </dl>
        {accountCreatedAt !== undefined && (
          <dl className="border-t pt-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <dt className="text-muted-foreground">Ngày tạo tài khoản</dt>
              <dd className="font-medium">{formatDateVN(accountCreatedAt)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* --- Job đã tạo --- */}
      <section className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">💼 Job đã tạo ({jobsCreated.length})</h3>
        {jobsCreated.length > 0 ? (
          <div className={JOB_GRID_CLASS}>
            {jobsCreated.map((job) => {
              const card = toJobCardData(job);
              return (
                <article
                  key={card.id}
                  className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
                >
                  <div className="flex items-center gap-2.5 border-b border-dashed border-border bg-[#FAFBFA] px-4 py-2.5">
                    <span className="mr-auto font-mono text-[11.5px] text-muted-foreground">
                      JOB-{card.id.slice(0, 8).toUpperCase()}
                    </span>
                    {card.industry && (
                      <span
                        className="shrink-0 rounded-full px-2 py-[3px] font-mono text-[11px] font-semibold whitespace-nowrap"
                        style={{
                          background: (INDUSTRY_BADGE_STYLES[card.industry] ?? INDUSTRY_BADGE_FALLBACK).bg,
                          color: (INDUSTRY_BADGE_STYLES[card.industry] ?? INDUSTRY_BADGE_FALLBACK).fg,
                        }}
                      >
                        {card.industry}
                      </span>
                    )}
                    {card.level && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-[3px] text-[11px] whitespace-nowrap text-[var(--brand-ink-soft)]">
                        {card.level}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <div className="flex items-start justify-between gap-2.5">
                      <h4 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
                        <Link href={`/jobs/${card.id}`} className="hover:text-primary">
                          {card.position}
                        </Link>
                      </h4>
                      <span
                        className={
                          "shrink-0 rounded-full px-[9px] py-1 text-[11px] font-semibold whitespace-nowrap " +
                          (card.statusRaw === "OPEN"
                            ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
                            : "bg-[#EDEFEC] text-muted-foreground")
                        }
                      >
                        {card.statusLabel}
                      </span>
                    </div>
                    <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">
                      {card.company}
                      {card.location && ` · ${card.location}`}
                    </p>
                    <div className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                      <span>📅 Hạn: {formatDateVN(card.deadline)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            {EMPTY[subject].jobs}
          </div>
        )}
      </section>

      {/* --- Công ty đã tạo --- */}
      <section className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">🏢 Công ty đã tạo ({companiesCreated.length})</h3>
        {companiesCreated.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Công ty</th>
                  <th className="px-3 py-2 font-medium">Lĩnh vực</th>
                  <th className="px-3 py-2 font-medium">Thành phố</th>
                  <th className="px-3 py-2 font-medium">Tiềm năng</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companiesCreated.map((c) => (
                  <tr key={c.company_id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/companies/${c.company_id}`} className="font-medium underline">
                        {c.company_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.industry || "—"}</td>
                    <td className="px-3 py-2">{c.province_name || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-xs">
                        {PARTNERSHIP_POTENTIAL_LABELS[c.partnership_potential] ?? c.partnership_potential}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/companies/${c.company_id}`} className="text-sm underline">
                        Xem →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            {EMPTY[subject].companies}
          </div>
        )}
      </section>

      {/* --- Contact đã tạo --- */}
      <section className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">☎ Contact đã tạo ({contactsCreated.length})</h3>
        {contactsCreated.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên</th>
                  <th className="px-3 py-2 font-medium">Công ty</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                  <th className="px-3 py-2 font-medium">Đang phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {contactsCreated.map((c) => (
                  <tr key={c.contact_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.contact_name}</td>
                    <td className="px-3 py-2">
                      <Link href={`/companies/${c.company_id}`} className="underline">
                        {c.company_name || "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.work_email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CONTACT_STATUS_LABELS[c.contact_status] ?? c.contact_status}
                    </td>
                    <td className="px-3 py-2">
                      <ContactAssignCell
                        companyId={c.company_id}
                        contactId={c.contact_id}
                        assigneeId={c.assigned_ss_user ?? null}
                        staff={assignees}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            {EMPTY[subject].contactsCreated}
          </div>
        )}
      </section>

      {/* --- Contact đang phụ trách --- */}
      <section className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">
          🗂️ Contact đang phụ trách ({contactsAssigned.length})
        </h3>
        {contactsAssigned.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên</th>
                  <th className="px-3 py-2 font-medium">Công ty</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Người tạo</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                  <th className="px-3 py-2 font-medium">Đổi người phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {contactsAssigned.map((c) => (
                  <tr key={c.contact_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.contact_name}</td>
                    <td className="px-3 py-2">
                      <Link href={`/companies/${c.company_id}`} className="underline">
                        {c.company_name || "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.work_email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {(c.created_by && staffById.get(c.created_by)) || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CONTACT_STATUS_LABELS[c.contact_status] ?? c.contact_status}
                    </td>
                    <td className="px-3 py-2">
                      <ContactAssignCell
                        companyId={c.company_id}
                        contactId={c.contact_id}
                        assigneeId={c.assigned_ss_user ?? null}
                        staff={assignees}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            {EMPTY[subject].contactsAssigned}
          </div>
        )}
      </section>
    </>
  );
}
