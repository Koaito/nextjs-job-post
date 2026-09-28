"use client";
// components/email-template-picker-modal.tsx
// Nút "✉ Mẫu email" + popup chọn/soạn mẫu — tương đương
// _contact_email_template_button.html + initEmailTemplateModal() (app.js) +
// #emailTemplateModal (base.html) bên Flask. Nhóm 2, Phần 3 của plan.
//
// Plan (Phần 2 mục 5): component này KHÔNG gọi API để submit gì cả, chỉ đọc
// list mẫu rồi thay placeholder TẠI CHỖ để staff copy — client-side thuần.
// Khác Flask ở nguồn dữ liệu: Flask nhúng sẵn JSON vào MỌI trang staff
// (context_processor inject_email_templates), Next.js fetch lúc staff THẬT
// SỰ mở popup (GET /api/email-templates) rồi giữ lại cho các lần mở sau
// trong cùng phiên trang (biến module `cache`) — đúng tinh thần "tránh gọi
// API thừa" của plan, và mẫu vừa sửa ở /contacts/email-templates sẽ thấy
// ngay ở lần tải trang kế tiếp vì cache chỉ sống theo vòng đời trang.
//
// Đúng 2 bước như Flask:
//   1) danh sách mẫu — mẫu có `recommended_for` chứa trạng thái contact hiện
//      tại được gắn thẻ "Gợi ý cho trạng thái hiện tại";
//   2) nội dung mẫu đã điền sẵn, sửa được trong <textarea> nhưng KHÔNG lưu:
//      quay lại danh sách/đóng popup là mất phần đã sửa, mở lại luôn ra bản
//      gốc.
//
// Nội dung mẫu do staff nhập -> chỉ render bằng text thuần (JSX tự escape),
// TUYỆT ĐỐI không dangerouslySetInnerHTML (plan Nhóm 4 — nguyên tắc chung
// cho mọi nội dung người dùng nhập). Flask từng ghép innerHTML cho tiêu đề
// mẫu; ở đây không lặp lại.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmailTemplateOut } from "@/lib/api/email-templates";
import { fillPlaceholders } from "@/lib/email-template-placeholders";

export interface EmailTemplateContext {
  companyName: string;
  contactName: string;
  contactTitle: string;
  /** Mã trạng thái contact (UNCONTACTED...) — để gắn thẻ "Gợi ý". */
  contactStatus: string;
}

interface LoadedData {
  templates: EmailTemplateOut[];
  staffName: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: LoadedData }
  | { kind: "error"; message: string; unauthorized: boolean };

// Giữ kết quả giữa các lần mở popup trong cùng phiên trang (nhiều nút cùng
// trang dùng chung 1 lần fetch). Chỉ lưu bản thành công.
let cache: LoadedData | null = null;
let inflight: Promise<LoadedData> | null = null;

async function loadTemplates(): Promise<LoadedData> {
  if (cache) return cache;
  // Nhiều nút bấm gần nhau chỉ tốn 1 request.
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("/api/email-templates", { cache: "no-store" });
    if (!res.ok) {
      const err = new Error(String(res.status));
      err.name = "HttpError";
      throw err;
    }
    const json = (await res.json()) as { templates?: EmailTemplateOut[]; staffName?: string };
    const data: LoadedData = { templates: json.templates ?? [], staffName: json.staffName ?? "" };
    cache = data;
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function EmailTemplatePickerModal({ context }: { context: EmailTemplateContext }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [selected, setSelected] = useState<EmailTemplateOut | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const data = await loadTemplates();
      setState({ kind: "ready", data });
    } catch (err) {
      const status = err instanceof Error ? err.message : "";
      setState({
        kind: "error",
        unauthorized: status === "401" || status === "403",
        message:
          status === "401"
            ? "Phiên đăng nhập đã hết hạn — vui lòng tải lại trang và đăng nhập lại."
            : "Không tải được danh sách mẫu email, thử lại sau.",
      });
    }
  }, []);

  // Mở/đóng popup luôn quay về bước danh sách (Flask cũng "nạp lại ngữ
  // cảnh mỗi lần mở, không giữ trạng thái cũ") — làm ngay trong event
  // handler thay vì useEffect để khỏi setState đồng bộ trong effect.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    setSelected(null);
    setDraft("");
    // Nạp dữ liệu khi MỞ (dùng lại cache nếu đã có -> gần như tức thì).
    if (next) void load();
  }

  function openDetail(tpl: EmailTemplateOut, staffName: string) {
    setSelected(tpl);
    setDraft(fillPlaceholders(tpl.body, { ...context, staffName }));
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft);
        toast.success("Đã copy nội dung mẫu email!");
        return;
      }
      throw new Error("no-clipboard-api");
    } catch {
      // Trình duyệt cũ/không cấp quyền Clipboard API — chọn sẵn text để
      // staff tự Ctrl+C, vẫn tốt hơn báo lỗi không làm gì được (giống Flask).
      const el = document.getElementById("et-picker-body") as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.select();
        try {
          if (document.execCommand("copy")) {
            toast.success("Đã copy nội dung mẫu email!");
            return;
          }
        } catch {
          /* rơi xuống toast lỗi bên dưới */
        }
      }
      toast.error("Không tự copy được — nội dung đã bôi đen sẵn, bấm Ctrl+C.");
    }
  }

  const data = state.kind === "ready" ? state.data : null;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(true)}>
        ✉ Mẫu email
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? selected.title : "Mẫu email liên hệ doanh nghiệp"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Có thể sửa nội dung trước khi copy — không ảnh hưởng mẫu gốc."
                : context.companyName
                  ? `Chọn 1 mẫu để soạn email gửi cho ${context.contactName || "người liên hệ"} (${context.companyName}).`
                  : "Chọn 1 mẫu để bắt đầu soạn email."}
            </DialogDescription>
          </DialogHeader>

          {state.kind === "loading" && <p className="text-sm text-muted-foreground">Đang tải mẫu email…</p>}

          {state.kind === "error" && (
            <div className="space-y-2">
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.message}
              </p>
              {!state.unauthorized && (
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                  Thử lại
                </Button>
              )}
            </div>
          )}

          {data && !selected && (
            <>
              {data.templates.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa có mẫu email nào — vào &ldquo;Quản lý mẫu email&rdquo; ở trang Danh sách contact để thêm mẫu
                  mới.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.templates.map((tpl) => {
                    const isRecommended = (tpl.recommended_for ?? []).includes(context.contactStatus);
                    return (
                      <li key={tpl.template_id}>
                        <button
                          type="button"
                          onClick={() => openDetail(tpl, data.staffName)}
                          className="flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left hover:bg-muted"
                        >
                          <strong>{tpl.title}</strong>
                          {tpl.description && (
                            <span className="text-sm text-muted-foreground">{tpl.description}</span>
                          )}
                          {isRecommended && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              Gợi ý cho trạng thái hiện tại
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {data && selected && (
            <div className="space-y-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Quay lại danh sách mẫu
              </Button>
              <textarea
                id="et-picker-body"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={14}
                aria-label="Nội dung email"
                className="min-h-[260px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed"
              />
              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleCopy()}>
                  Copy nội dung
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
