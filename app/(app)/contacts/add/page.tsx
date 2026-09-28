// app/(app)/contacts/add/page.tsx
// Alias theo plan (Nhóm 2, dòng 995): KHÔNG có trang thêm contact riêng,
// /contacts/add chỉ redirect về /them-moi?tab=contact — đúng hành vi GET
// contacts.add_any() bên Flask. (Bảng route dòng 420 ghi `/contacts/add` như
// route thật, mâu thuẫn dòng 995 — đã chốt theo dòng 995, cùng quyết định
// không có /companies/add ở Phần 1.)

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";

export default async function ContactsAddAliasPage() {
  await requireStaff();
  redirect("/them-moi?tab=contact");
}
