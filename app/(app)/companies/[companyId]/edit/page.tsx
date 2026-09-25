// app/(app)/companies/[companyId]/edit/page.tsx
// Tương đương add_company.html (nhánh sửa, route companies.edit bên
// Flask) — Nhóm 2, Phần 1. Dùng chung <CompanyForm mode="edit">.
//
// Gợi ý "Tiềm năng hợp tác" tính bằng suggestPartnershipPotentialFull()
// (company.jobs có sẵn từ CompanyDetailOut + contacts lấy riêng qua
// listContactsByCompany, include_inactive=true — khớp Flask edit() dùng
// contacts_for_score = list_contacts() y hệt).

import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getCompany } from "@/lib/api/companies";
import { listContactsByCompany, type CompanyContactOut } from "@/lib/api/contacts";
import { suggestPartnershipPotentialFull } from "@/lib/company-potential";
import { CompanyForm, type CompanyFormValues } from "@/components/company-form";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireStaff();
  const { companyId } = await params;

  const [company, contacts] = await Promise.all([
    getCompany(companyId),
    listContactsByCompany(companyId).catch(() => [] as CompanyContactOut[]),
  ]);
  if (!company) notFound();

  const initialValues: CompanyFormValues = {
    companyName: company.company_name,
    taxId: company.tax_id ?? "",
    website: company.website ?? "",
    industry: company.industry ?? "",
    companySize: company.company_size ?? "",
    address: company.address ?? "",
    provinceName: company.province_name ?? "",
    fanpageUrl: company.fanpage_url ?? "",
    linkedinUrl: company.linkedin_url ?? "",
    partnershipPotential: company.partnership_potential,
  };

  const suggestion = suggestPartnershipPotentialFull(company, company.jobs ?? [], contacts);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <span className="text-sm text-muted-foreground">Career Hub / Doanh nghiệp / {company.company_name}</span>
        <h1 className="font-heading text-2xl font-semibold">Sửa thông tin công ty</h1>
      </div>
      <CompanyForm mode="edit" companyId={companyId} initialValues={initialValues} suggestion={suggestion} />
    </div>
  );
}
