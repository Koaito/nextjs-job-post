// app/(app)/companies/add/page.tsx
// Alias theo plan (Nhóm 2, dòng 995): KHÔNG có trang thêm công ty riêng,
// /companies/add chỉ redirect về /them-moi?tab=company — đúng hành vi GET
// companies.add() bên Flask. Cần file này vì không có nó, "add" sẽ bị khớp
// vào route động [companyId] rồi ra 404.

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";

export default async function CompaniesAddAliasPage() {
  await requireStaff();
  redirect("/them-moi?tab=company");
}
