// app/(app)/contacts/email-templates/page.tsx
// Tương đương tab "Quản lý mẫu email" (/contacts?tab=quan-ly) +
// _email_template_manager.html + blueprints/contacts.py::_email_templates_tab()
// bên Flask (Nhóm 2, Phần 3 của plan). Staff-only — khớp @staff_required.
//
// Plan: đây là 1 route con THẬT (không phải fetch-fragment-rồi-chèn-DOM như
// Flask), dùng chung layout tab-nav với /contacts (contacts/layout.tsx). KHÔNG
// cache (dynamic = "force-dynamic" + callAuthed mặc định no-store) — mẫu vừa
// sửa/xoá phải hiện đúng ngay, không để Router Cache giữ kết quả cũ.
//
// KHÔNG dùng chung component với popup <EmailTemplatePickerModal>: trang
// quản trị cần URL/state riêng (deep-link ?edit=<id>), popup thì không.

import { requireStaff } from "@/lib/auth-guard";
import {
  getEmailTemplate,
  getPlaceholderHelp,
  listEmailTemplates,
  type EmailTemplateOut,
} from "@/lib/api/email-templates";
import { EmailTemplateManager } from "./email-template-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý mẫu email — MindX Career Hub",
};

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireStaff();
  const { edit } = await searchParams;
  const editId = (edit ?? "").trim();

  // 3 lệnh gọi ĐỘC LẬP -> song song; allSettled để 1 lệnh lỗi không kéo sập
  // các lệnh còn lại (Flask cũng try/except riêng từng lệnh). Riêng
  // getPlaceholderHelp() tự nuốt lỗi (trả {}) nên luôn "fulfilled".
  const [templatesRes, helpRes, editingRes] = await Promise.allSettled([
    listEmailTemplates(),
    getPlaceholderHelp(),
    editId ? getEmailTemplate(editId) : Promise.resolve(null),
  ]);

  const errors: string[] = [];

  let templates: EmailTemplateOut[] = [];
  if (templatesRes.status === "fulfilled") templates = templatesRes.value;
  else errors.push(errorMessage(templatesRes.reason));

  const placeholderHelp = helpRes.status === "fulfilled" ? helpRes.value : {};

  let editing: EmailTemplateOut | null = null;
  if (editId) {
    if (editingRes.status === "fulfilled") {
      editing = editingRes.value;
      // Khớp Flask: gõ ?edit=<id> không tồn tại (đã bị xoá/sai UUID) -> báo
      // rõ, vẫn hiện danh sách bình thường thay vì trang lỗi.
      if (editing === null) errors.push("Không tìm thấy mẫu email cần sửa (có thể đã bị xoá).");
    } else {
      errors.push(errorMessage(editingRes.reason));
    }
  }

  return (
    <div className="space-y-6">
      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Doanh nghiệp</span>
        <h1 className="font-heading text-3xl font-semibold">Quản lý mẫu email</h1>
      </header>

      <EmailTemplateManager templates={templates} placeholderHelp={placeholderHelp} editing={editing} />
    </div>
  );
}
