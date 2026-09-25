// app/(app)/companies/[companyId]/page.tsx
// Tương đương company_detail.html (Nhóm 2, Phần 1 của plan). Staff-only
// (requireStaff(), giống /jobs/[jobId]/edit) — khác /jobs/[jobId] (public).
//
// Bảng "Người liên hệ" ở đây là READ-ONLY (quyết định đã chốt với user —
// form/sửa trạng thái/assign contact thuộc Phần 2, chưa làm). Nếu GET
// /companies/{id}/contacts lỗi (vd token hết hạn giữa lúc load 2 request
// song song) -> catch về [] thay vì làm sập cả trang chi tiết công ty chỉ
// vì phần phụ này, khớp tinh thần "job chính hiện được là ưu tiên" của
// jobs/[jobId]/page.tsx (applicants/savers cũng .catch(() => [])).

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getCompany } from "@/lib/api/companies";
import { listContactsByCompany, type CompanyContactOut } from "@/lib/api/contacts";
import { toJobCardData } from "@/lib/api/jobs";
import { PARTNERSHIP_POTENTIAL_LABELS, CONTACT_STATUS_LABELS } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { DeleteCompanyButton } from "./delete-company-button";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

function ContactRow({ contact }: { contact: CompanyContactOut }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 font-medium">{contact.contact_name}</td>
      <td className="py-1.5 pr-3 text-muted-foreground">{contact.job_title || "—"}</td>
      <td className="py-1.5 pr-3">{contact.work_email || "—"}</td>
      <td className="py-1.5 pr-3">{contact.phone_number || "—"}</td>
      <td className="py-1.5 pr-3">{CONTACT_STATUS_LABELS[contact.contact_status] ?? contact.contact_status}</td>
    </tr>
  );
}

function ContactTable({ contacts }: { contacts: CompanyContactOut[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b text-left text-xs text-muted-foreground">
        <tr>
          <th className="py-1.5 pr-3 font-medium">Tên</th>
          <th className="py-1.5 pr-3 font-medium">Chức danh</th>
          <th className="py-1.5 pr-3 font-medium">Email</th>
          <th className="py-1.5 pr-3 font-medium">SĐT</th>
          <th className="py-1.5 pr-3 font-medium">Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => (
          <ContactRow key={c.contact_id} contact={c} />
        ))}
      </tbody>
    </table>
  );
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireStaff();
  const { companyId } = await params;
  const { notice } = await searchParams;

  const [company, contacts] = await Promise.all([
    getCompany(companyId),
    listContactsByCompany(companyId).catch(() => [] as CompanyContactOut[]),
  ]);
  if (!company) notFound();

  const activeContacts = contacts.filter((c) => c.is_active);
  const inactiveContacts = contacts.filter((c) => !c.is_active);
  const jobs = company.jobs ?? [];

  return (
    <div className="space-y-6">
      <Link href="/companies" className="text-sm text-muted-foreground underline">
        ← Danh sách công ty
      </Link>

      {notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">{company.industry || "Chưa xác định lĩnh vực"}</span>
          <h1 className="font-heading text-2xl font-semibold">{company.company_name}</h1>
          <p className="mt-1 text-muted-foreground">
            {company.province_name || "Chưa rõ địa điểm"}
            {company.company_size && ` · Quy mô ${company.company_size}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {PARTNERSHIP_POTENTIAL_LABELS[company.partnership_potential] ?? company.partnership_potential}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Job đã đăng ({jobs.length})</h4>
            {jobs.length > 0 ? (
              <ul className="mt-2 divide-y text-sm">
                {jobs.map((j) => {
                  const card = toJobCardData(j);
                  return (
                    <li key={card.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <Link href={`/jobs/${card.id}`} className="font-medium underline">
                          {card.position}
                        </Link>
                        <p className="text-muted-foreground">
                          {card.level || "—"} · {card.location || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs">{card.statusLabel}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Công ty này chưa có job nào.</p>
            )}
          </section>

          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Người liên hệ ({activeContacts.length})</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Chỉ xem — sửa trạng thái, assign hoặc thêm người liên hệ mới sẽ có ở phần tiếp theo.
            </p>
            {activeContacts.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <ContactTable contacts={activeContacts} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Chưa có người liên hệ nào.</p>
            )}

            {inactiveContacts.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground underline">
                  Đã xoá ({inactiveContacts.length})
                </summary>
                <div className="mt-2 overflow-x-auto opacity-60">
                  <ContactTable contacts={inactiveContacts} />
                </div>
              </details>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border p-4">
            <div className="flex flex-wrap gap-2">
              <Link href={`/companies/${company.company_id}/edit`} className={buttonVariants({ variant: "outline" })}>
                Sửa thông tin
              </Link>
              <DeleteCompanyButton companyId={company.company_id} companyName={company.company_name} />
            </div>
          </section>

          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Thông tin nhanh</h4>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Mã số thuế</dt>
                <dd>{company.tax_id || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Website</dt>
                <dd>
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="underline">
                      Xem ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Địa chỉ</dt>
                <dd className="text-right">{company.address || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Fanpage</dt>
                <dd>
                  {company.fanpage_url ? (
                    <a href={company.fanpage_url} target="_blank" rel="noopener noreferrer" className="underline">
                      Xem ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">LinkedIn</dt>
                <dd>
                  {company.linkedin_url ? (
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">
                      Xem ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Ngày tạo</dt>
                <dd>{formatDate(company.created_at)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
