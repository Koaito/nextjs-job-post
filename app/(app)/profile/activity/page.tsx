// app/(app)/profile/activity/page.tsx
// Tương đương profile_activity.html + blueprints/profile.py::activity()
// (Flask) — "Hoạt động của bạn". Nhóm 5, Đợt 5.4 của plan. Khung (tiêu đề
// "Trang cá nhân" + sub-nav) nằm ở profile/layout.tsx.
//
// CHỈ STAFF: requireStaff() (học viên không tự tạo job/công ty/contact,
// mục "Hoạt động" cũng không hiện với họ trong sub-nav — @staff_required ở
// Flask, KHÔNG phải @login_required như 2 route overview/security).
//
// Cùng dữ liệu/logic với /staff-activity/[id] (Nhóm 3, CHƯA làm) — trang
// đó cho staff/admin xem hoạt động của NGƯỜI KHÁC, trang này chỉ xem của
// CHÍNH MÌNH (ss_user_id luôn = user hiện tại, không nhận tham số nào từ
// URL). Khi làm Nhóm 3, phần dữ liệu/markup ở đây nên tách lại thành hàm
// dùng chung thay vì viết trùng.
//
// 4 lệnh gọi ĐỘC LẬP (job/công ty/contact tự tạo + contact đang phụ trách),
// chạy song song bằng Promise.allSettled (khớp cách profile.py song song
// hoá bằng ThreadPoolExecutor) — 1 lệnh lỗi không kéo sập 3 lệnh còn lại.
// force-dynamic (no-store, cùng nhóm dashboard/staff-activity ở Phần 4 mục
// 4 của plan): đổi người phụ trách/trạng thái contact ở chính trang này
// phải thấy ngay khi router.refresh(), không đợi cache.

import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { listAllJobsCreatedBy, toJobCardData } from "@/lib/api/jobs";
import { listAllCompaniesCreatedBy } from "@/lib/api/companies";
import { listAllContacts, type CompanyContactWithCompanyOut } from "@/lib/api/contacts";
import { listStaffUsers } from "@/lib/api/auth";
import { ContactAssignCell } from "@/components/contact-cells";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import { PARTNERSHIP_POTENTIAL_LABELS, CONTACT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động — Trang cá nhân — MindX Career Hub",
};

const VN_TZ = "Asia/Ho_Chi_Minh";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { timeZone: VN_TZ });
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

export default async function ProfileActivityPage() {
  const user = await requireStaff();
  const ssUserId = user.ss_user_id;

  const [jobsRes, companiesRes, contactsCreatedRes, contactsAssignedRes, staffRes] =
    await Promise.allSettled([
      listAllJobsCreatedBy(ssUserId),
      listAllCompaniesCreatedBy(ssUserId),
      listAllContacts({ created_by: ssUserId }),
      listAllContacts({ assigned_ss_user: ssUserId }),
      listStaffUsers(),
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
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Hoạt động của bạn</h2>
        <p className="text-muted-foreground">
          Job/công ty/contact bạn đã tự thêm tay, và contact đang được giao cho bạn phụ trách.
        </p>
      </div>

      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <dl className="grid grid-cols-2 gap-4 rounded-md border p-4 sm:grid-cols-4">
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
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h4 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
                      <Link href={`/jobs/${card.id}`} className="hover:text-primary">
                        {card.position}
                      </Link>
                    </h4>
                    <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">
                      {card.company}
                      {card.location && ` · ${card.location}`}
                    </p>
                    <div className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                      <span>📅 Hạn: {formatDate(card.deadline)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            Bạn chưa tự thêm job nào.
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
            Bạn chưa tự thêm công ty nào.
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
            Bạn chưa tự thêm contact nào.
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
            Bạn chưa được giao phụ trách contact nào.
          </div>
        )}
      </section>
    </div>
  );
}
