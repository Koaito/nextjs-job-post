// app/(app)/companies/[companyId]/contacts/add/page.tsx
// Tương đương contacts.add(company_id) + add_contact.html (nhánh thêm, công
// ty gắn sẵn) — Nhóm 2, Phần 2, mục 2. Plan (bảng route, dòng 421) ghi đây
// là route thật `/companies/[companyId]/contacts/add`, khác `/them-moi` (thêm
// contact KHÔNG gắn sẵn công ty). Dùng chung <ContactForm mode="create">
// với `fixedCompany` -> ẩn combobox, hiện tên công ty. Lưu xong về chi tiết
// công ty (khớp Flask: redirect companies.detail).

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getCompany } from "@/lib/api/companies";
import { ContactForm } from "@/components/contact-form";

export default async function AddContactForCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireStaff();
  const { companyId } = await params;

  const company = await getCompany(companyId);
  if (!company) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      <Link href={`/companies/${company.company_id}`} className="text-sm text-muted-foreground underline">
        ← {company.company_name}
      </Link>
      <div>
        <span className="text-sm text-muted-foreground">Career Hub / Doanh nghiệp / {company.company_name}</span>
        <h1 className="font-heading text-2xl font-semibold">Thêm người liên hệ</h1>
      </div>
      <ContactForm mode="create" fixedCompany={{ id: company.company_id, name: company.company_name }} />
    </div>
  );
}
