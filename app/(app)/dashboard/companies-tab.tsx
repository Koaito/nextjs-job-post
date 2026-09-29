// app/(app)/dashboard/companies-tab.tsx
// Tab "Doanh nghiệp" của /dashboard — tương đương khối #tab-doanh-nghiep ở
// dashboard.html + _companies_high_potential_no_contact/_contacts_needing_
// followup/_companies_job_activity ở blueprints/dashboard.py (Flask). Nhóm 3,
// Đợt 3.1 (phần 3/4).
//
// Server Component bất đồng bộ, CHỈ tải dữ liệu tab này bằng 1 lệnh gọi
// GET /dashboard/insights/companies?followup_days=N (backend Scrap_JD đã tính
// sẵn 4 khối bằng SQL theo giờ VN). Khác Flask, không kéo toàn bộ job/công
// ty/contact về rồi tự tính. `followupDays` do page.tsx đã validate whitelist
// 7|14|30 (parseFollowupDays) trước khi truyền vào đây.
//
// Lỗi tải -> chỉ hiện banner (kèm ô chọn ngày để đổi lại được), KHÔNG hiện các
// dòng "... — ổn"/"Không có ..." vì sẽ sai khi thật ra chưa tải được dữ liệu.
// Cột "Trạng thái" của contact có thể trống nếu backend đổi mã mới: rơi về
// hiển thị đúng mã thô thay vì trống.

import Link from "next/link";
import { getCompanyInsights, type CompanyInsightsOut } from "@/lib/api/dashboard";
import { EmailTemplatePickerModal } from "@/components/email-template-picker-modal";
import { CONTACT_STATUS_LABELS } from "@/lib/constants";
import { formatDateVN } from "@/lib/date";
import { NO_CONTACT_REASON_LABELS, type FollowupDays } from "@/lib/dashboard/companies";
import { FollowupDaysSelect } from "./followup-days-select";
import { PaginatedTable } from "./paginated-table";
import { RecentJobsBadge } from "./recent-jobs-badge";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

function Section({
  title,
  count,
  suffix,
  description,
  aside,
  children,
}: {
  title: string;
  count?: number;
  /** Chú thích ngưỡng cạnh tiêu đề, vd "(≥2 job mới / 30 ngày)". */
  suffix?: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="font-heading text-base font-semibold">
          {title}
          {count !== undefined && <span className="font-normal text-muted-foreground"> ({count})</span>}
          {suffix && <span className="font-normal text-muted-foreground"> {suffix}</span>}
        </h4>
        {aside}
      </div>
      {description && <p className="mb-3.5 mt-1 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3.5 text-[13px] text-muted-foreground">{children}</p>;
}

const TAG_BASE = "inline-block whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-semibold";

/** Nhãn cam nhạt — tương đương .reason-tag bên Flask. */
function ReasonTag({ children }: { children: React.ReactNode }) {
  return <span className={`${TAG_BASE} bg-[var(--brand-amber-soft)] text-[var(--brand-amber)]`}>{children}</span>;
}

function CompanyLink({ companyId, name }: { companyId: string; name: string }) {
  return (
    <Link href={`/companies/${companyId}`} className="text-primary hover:underline">
      {name}
    </Link>
  );
}

const TH = "px-3 py-2 font-medium";

export async function CompaniesTab({ followupDays }: { followupDays: FollowupDays }) {
  let data: CompanyInsightsOut | null = null;
  let error: string | null = null;
  try {
    data = await getCompanyInsights(followupDays);
  } catch (err) {
    error = errorMessage(err);
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
        <FollowupDaysSelect value={followupDays} />
      </div>
    );
  }

  const {
    companies_no_contact: noContact,
    contacts_needing_followup: followups,
    companies_expanding: expanding,
    companies_quiet: quiet,
  } = data;

  return (
    <div className="space-y-6">
      <Section
        title="Contact cần follow-up"
        count={followups.length}
        aside={<FollowupDaysSelect value={followupDays} />}
        description={`Contact chưa "Đang hợp tác" mà im lặng ≥ ${followupDays} ngày (tính từ lần liên hệ gần nhất, hoặc từ ngày thu thập nếu chưa từng liên hệ) — nên chủ động nhắn lại.`}
      >
        {followups.length > 0 ? (
          <PaginatedTable
            head={
              <tr>
                <th className={`w-[22%] ${TH}`}>Contact</th>
                <th className={`w-[22%] ${TH}`}>Công ty</th>
                <th className={`w-[16%] ${TH}`}>Trạng thái</th>
                <th className={`w-[22%] ${TH}`}>Liên hệ cuối</th>
                <th className={`w-[18%] ${TH}`}></th>
              </tr>
            }
            rows={followups.map((c) => (
              <tr key={c.contact_id} className="border-b last:border-0">
                <td className="px-3 py-2 font-semibold">{c.contact_name}</td>
                <td className="px-3 py-2">
                  {c.company_id ? (
                    <CompanyLink companyId={c.company_id} name={c.company_name || "—"} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">{CONTACT_STATUS_LABELS[c.contact_status] ?? c.contact_status}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {c.never_contacted ? (
                    <ReasonTag>Chưa từng liên hệ ({c.quiet_days} ngày)</ReasonTag>
                  ) : (
                    <>
                      {formatDateVN(c.last_contacted_date)} <span>({c.quiet_days} ngày trước)</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <EmailTemplatePickerModal
                    context={{
                      companyName: c.company_name ?? "",
                      contactName: c.contact_name,
                      contactTitle: c.job_title ?? "",
                      contactStatus: c.contact_status,
                    }}
                  />
                </td>
              </tr>
            ))}
          />
        ) : (
          <EmptyNote>Không có contact nào đang bị bỏ ngỏ quá {followupDays} ngày.</EmptyNote>
        )}
      </Section>

      <Section
        title="Công ty tiềm năng cao nhưng thiếu contact"
        count={noContact.length}
        description={`Công ty có "Tiềm năng hợp tác" = Cao nhưng chưa có contact nào, hoặc mọi contact đã "nguội" (chưa liên hệ lại ≥ 60 ngày) — ưu tiên gọi/email trong tháng.`}
      >
        {noContact.length > 0 ? (
          <PaginatedTable
            head={
              <tr>
                <th className={`w-[28%] ${TH}`}>Công ty</th>
                <th className={`w-[18%] ${TH}`}>Thành phố</th>
                <th className={`w-[34%] ${TH}`}>Lý do</th>
                <th className={`w-[20%] ${TH}`}>Liên hệ cuối</th>
              </tr>
            }
            rows={noContact.map((c) => (
              <tr key={c.company_id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <CompanyLink companyId={c.company_id} name={c.company_name} />
                </td>
                <td className="px-3 py-2">{c.city || "—"}</td>
                <td className="px-3 py-2">
                  <ReasonTag>{NO_CONTACT_REASON_LABELS[c.reason] ?? c.reason}</ReasonTag>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDateVN(c.last_contacted)}</td>
              </tr>
            ))}
          />
        ) : (
          <EmptyNote>Mọi công ty tiềm năng Cao đều đang có contact được theo dõi gần đây.</EmptyNote>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Đang mở rộng tuyển dụng"
          suffix="(≥2 job mới / 30 ngày)"
          description="Dấu hiệu công ty đang tuyển mạnh — cơ hội đề xuất hợp tác dài hạn thay vì từng job lẻ."
        >
          {expanding.length > 0 ? (
            <PaginatedTable
              head={
                <tr>
                  <th className={`w-[70%] ${TH}`}>Công ty</th>
                  <th className={`w-[30%] ${TH}`}>Job mới (30 ngày)</th>
                </tr>
              }
              rows={expanding.map((c) => (
                <tr key={c.company_id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <CompanyLink companyId={c.company_id} name={c.company_name} />
                  </td>
                  <td className="px-3 py-2">
                    <RecentJobsBadge count={c.recent_job_count} jobs={c.recent_jobs} />
                  </td>
                </tr>
              ))}
            />
          ) : (
            <EmptyNote>Chưa có công ty nào đăng ≥2 job mới trong 30 ngày qua.</EmptyNote>
          )}
        </Section>

        <Section
          title="Im lặng lâu"
          suffix="(>75 ngày không có job mới)"
          description="Công ty từng có job nhưng lâu rồi không đăng thêm — cần chủ động liên hệ lại xem còn nhu cầu tuyển không."
        >
          {quiet.length > 0 ? (
            <PaginatedTable
              head={
                <tr>
                  <th className={`w-[40%] ${TH}`}>Công ty</th>
                  <th className={`w-[35%] ${TH}`}>Job gần nhất</th>
                  <th className={`w-[25%] ${TH}`}>Đã im lặng</th>
                </tr>
              }
              rows={quiet.map((c) => (
                <tr key={c.company_id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <CompanyLink companyId={c.company_id} name={c.company_name} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateVN(c.last_job_date)}</td>
                  <td className="px-3 py-2">
                    <ReasonTag>{c.quiet_days} ngày</ReasonTag>
                  </td>
                </tr>
              ))}
            />
          ) : (
            <EmptyNote>Không có công ty nào im lặng quá lâu.</EmptyNote>
          )}
        </Section>
      </div>
    </div>
  );
}
