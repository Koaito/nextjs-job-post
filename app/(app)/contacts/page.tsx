// app/(app)/contacts/page.tsx
// Tương đương contacts.html (tab "danh-sach") + _contact_list.html +
// blueprints/contacts.py::_contact_list_tab() bên Flask (Nhóm 2, Phần 2,
// mục 1 của plan). Staff-only — khớp @staff_required.
//
// PHẠM VI mục 1: chỉ ĐỌC + lọc. Cố ý CHƯA có (làm ở các mục sau, không
// dựng link/nút chết):
//   - mục 3: cell đổi trạng thái / đổi người phụ trách tại chỗ — ở đây 2
//     cột này hiện read-only;
//   - mục 2: link "Sửa" contact (<ContactForm>);
//   - mục 5: nút "Xóa" (NoteConfirmDialog noteRequired);
//   - Phần 3: nút "✉ Mẫu email" (EmailTemplatePickerModal).
// Vì vậy chưa có cột thao tác ở cuối bảng.
//
// Không phân trang: GET /contacts trả thẳng mảng (không có `total`), Flask
// cũng render hết — giữ nguyên.
//
// Không cache (plan Nhóm 2): force-dynamic + callAuthed mặc định no-store.

import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { listAllContacts, type CompanyContactWithCompanyOut } from "@/lib/api/contacts";
import { listAllCompanies } from "@/lib/api/companies";
import { listStaffUsers } from "@/lib/api/auth";
import { CONTACT_STATUS_CODES, CONTACT_STATUS_LABELS } from "@/lib/constants";
import { ContactFilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Danh sách contact — MindX Career Hub",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VN_TZ = "Asia/Ho_Chi_Minh";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Đặt timeZone VN tường minh: server Vercel chạy UTC (Phụ lục F).
  return d.toLocaleDateString("vi-VN", { timeZone: VN_TZ });
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

interface ContactsPageSearchParams {
  q?: string;
  company_id?: string;
  status?: string;
  /** Thông báo 1 lần sau redirect từ nơi khác về đây (vd xoá contact ở
   *  mục 5 sẽ redirect `/contacts?notice=...`). Nhận sẵn từ bây giờ để
   *  không lặp lại lỗi "thông báo mất tích" đã gặp ở /companies. */
  notice?: string;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactsPageSearchParams>;
}) {
  await requireStaff();
  const params = await searchParams;

  // Chỉ nhận giá trị hợp lệ — gõ tay URL sai (status lạ, company_id không
  // phải UUID) sẽ bị backend trả 400; bỏ qua bộ lọc đó thay vì hỏng trang.
  const filters = {
    q: (params.q ?? "").trim(),
    status: (CONTACT_STATUS_CODES as readonly string[]).includes(params.status ?? "") ? params.status! : "",
    company_id: UUID_RE.test(params.company_id ?? "") ? params.company_id! : "",
  };

  // 3 lệnh gọi ĐỘC LẬP (contact đã lọc, danh sách công ty cho dropdown,
  // nhân sự để map người phụ trách) — chạy song song như Flask
  // (ThreadPoolExecutor); allSettled để 1 lệnh lỗi không kéo sập 2 lệnh
  // còn lại (Flask cũng except riêng từng future).
  const [contactsRes, companiesRes, staffRes] = await Promise.allSettled([
    listAllContacts(filters),
    listAllCompanies(),
    listStaffUsers(),
  ]);

  const errors: string[] = [];
  let contacts: CompanyContactWithCompanyOut[] = [];
  if (contactsRes.status === "fulfilled") contacts = contactsRes.value;
  else errors.push(errorMessage(contactsRes.reason));

  const companies = companiesRes.status === "fulfilled" ? companiesRes.value : [];
  if (companiesRes.status === "rejected") errors.push(errorMessage(companiesRes.reason));

  const staff = staffRes.status === "fulfilled" ? staffRes.value : [];
  if (staffRes.status === "rejected") errors.push(errorMessage(staffRes.reason));
  const staffNameById = new Map(staff.map((u) => [u.ss_user_id, u.full_name]));

  return (
    <div className="space-y-6">
      {params.notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {params.notice}
        </p>
      )}
      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Doanh nghiệp</span>
          <h1 className="font-heading text-3xl font-semibold">Danh sách contact</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Toàn bộ người liên hệ HR đã thu thập được, gộp từ mọi công ty — lọc theo trạng thái, công ty hoặc tìm theo
            tên để theo dõi tiến độ liên hệ.
          </p>
        </div>
        {/* Không có route /contacts/add riêng — alias về /them-moi?tab=contact
            (plan Nhóm 2, giống hành vi Flask contacts.add_any GET). */}
        <Link
          href="/them-moi?tab=contact"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ＋ Thêm người liên hệ
        </Link>
      </header>

      <ContactFilterBar companies={companies.map((c) => ({ id: c.id, name: c.name }))} />

      <p className="text-sm text-muted-foreground">{contacts.length} contact phù hợp</p>

      {contacts.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Tên</th>
                <th className="px-3 py-2 font-medium">Công ty</th>
                <th className="px-3 py-2 font-medium">Chức danh</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">SĐT</th>
                <th className="px-3 py-2 font-medium">Nguồn</th>
                <th className="px-3 py-2 font-medium">Liên hệ gần nhất</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.contact_id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{c.contact_name}</td>
                  <td className="px-3 py-2">
                    {c.company_id ? (
                      <Link href={`/companies/${c.company_id}`} className="underline">
                        {c.company_name || "—"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.job_title || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.work_email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.phone_number || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.found_source || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(c.last_contacted_date)}</td>
                  <td className="px-3 py-2">{CONTACT_STATUS_LABELS[c.contact_status] ?? c.contact_status}</td>
                  <td className="px-3 py-2">
                    {c.assigned_ss_user
                      ? (staffNameById.get(c.assigned_ss_user) ?? "Đã gán (không rõ tên)")
                      : "— Chưa gán —"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Chưa có contact nào khớp bộ lọc.
        </div>
      )}
    </div>
  );
}
