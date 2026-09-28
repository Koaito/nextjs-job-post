"use client";
// app/(app)/contacts/email-templates/email-template-manager.tsx
// Phần điều khiển của trang quản lý mẫu email (Client Component):
//   - nút "＋ Thêm mẫu email" mở form thêm (state cục bộ, như Flask: form ẩn
//     mặc định, bấm nút mới hiện + cuộn tới);
//   - "đang sửa mẫu nào" giữ ở QUERY STRING `?edit=<id>` (plan Nhóm 2:
//     "trang quản trị cần URL/state riêng, deep-link tới ?edit=<id> được"),
//     do page (Server Component) đọc searchParams.edit rồi truyền
//     `editing` xuống; component này chỉ đổi URL.
//
// Đổi URL bằng router.replace (không push): mở/đóng form sửa không nên
// thêm history entry để "Back" đi lùi qua từng lần bấm Sửa/Hủy — cùng tinh
// thần replace() của search-as-you-type ở /jobs.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmailTemplateForm } from "@/components/email-template-form";
import { DeleteEmailTemplateButton } from "@/components/delete-email-template-button";
import { CONTACT_STATUS_LABELS } from "@/lib/constants";
import type { EmailTemplateOut } from "@/lib/api/email-templates";

const PATH = "/contacts/email-templates";
const PREVIEW_LEN = 160;

export function EmailTemplateManager({
  templates,
  placeholderHelp,
  editing,
}: {
  templates: EmailTemplateOut[];
  placeholderHelp: Record<string, string>;
  /** Mẫu đang sửa (Server Component đã nạp theo ?edit=), null = không sửa. */
  editing: EmailTemplateOut | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Bấm Sửa (URL đổi) hoặc mở form thêm -> cuộn tới form, giống
  // scrollIntoView() + #et-manager-form của Flask.
  const showForm = adding || editing !== null;
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm, editing?.template_id]);

  function closeForm() {
    setAdding(false);
    if (editing) router.replace(PATH);
  }

  function handleSuccess(message: string) {
    toast.success(message);
    closeForm();
    // Server Action đã revalidatePath; refresh để danh sách (Server
    // Component) lấy dữ liệu mới mà không mất vị trí.
    router.refresh();
  }

  function startEdit(id: string) {
    setAdding(false);
    router.replace(`${PATH}?edit=${encodeURIComponent(id)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-muted-foreground">
          Mẫu ở đây dùng chung cho popup &ldquo;✉ Mẫu email&rdquo; ở mọi bảng contact (trang danh sách lẫn trang chi
          tiết công ty) — sửa/xoá ở đây có hiệu lực ngay cho toàn hệ thống.
        </p>
        {!showForm && (
          <Button type="button" onClick={() => setAdding(true)}>
            ＋ Thêm mẫu email
          </Button>
        )}
      </div>

      {showForm && (
        <div ref={formRef}>
          {/* key theo template_id: chuyển từ sửa mẫu A sang mẫu B (hoặc từ
              thêm sang sửa) phải dựng lại form với giá trị mới, không giữ
              state đang gõ của lần trước. */}
          <EmailTemplateForm
            key={editing ? editing.template_id : "create"}
            {...(editing
              ? {
                  mode: "edit" as const,
                  templateId: editing.template_id,
                  initialValues: {
                    title: editing.title,
                    description: editing.description ?? "",
                    body: editing.body,
                    recommendedFor: editing.recommended_for ?? [],
                    displayOrder: String(editing.display_order),
                  },
                }
              : { mode: "create" as const })}
            placeholderHelp={placeholderHelp}
            onSuccess={handleSuccess}
            onCancel={closeForm}
          />
        </div>
      )}

      {templates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {templates.map((tpl) => {
            const body = tpl.body.length > PREVIEW_LEN ? `${tpl.body.slice(0, PREVIEW_LEN)}…` : tpl.body;
            return (
              <div key={tpl.template_id} className="flex flex-col gap-2 rounded-md border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="font-heading">{tpl.title}</strong>
                  <span className="text-sm text-muted-foreground">#{tpl.display_order}</span>
                </div>
                {tpl.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}
                {(tpl.recommended_for ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(tpl.recommended_for ?? []).map((code) => (
                      <span key={code} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {CONTACT_STATUS_LABELS[code] ?? code}
                      </span>
                    ))}
                  </div>
                )}
                {/* Text thuần (JSX tự escape) — nội dung mẫu do staff nhập. */}
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(tpl.template_id)}>
                    Sửa
                  </Button>
                  <DeleteEmailTemplateButton templateId={tpl.template_id} templateTitle={tpl.title} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Chưa có mẫu email nào — bấm &ldquo;＋ Thêm mẫu email&rdquo; để tạo mẫu đầu tiên.
        </div>
      )}
    </div>
  );
}
