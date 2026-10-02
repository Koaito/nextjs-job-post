// app/(app)/messages/[partnerId]/page.tsx
// Tương đương messages_thread.html + blueprints/messages.py::thread() (Flask)
// — khung chat 1-1. Nhóm 4 (Messages), Phần 2/3, NỬA ĐẦU (xem, chưa polling):
//   [x] 2/3 nửa đầu — file này: tải lịch sử, tên/role người đối thoại, chặn
//                     tự chat, đánh dấu đã đọc, cuộn xuống cuối lúc mở
//   [ ] 2/3 nửa sau — Route Handler since + SWR polling + wasAtBottom
//   [ ] 3/3         — ô gửi tin (optimistic), huỷ request, nút Chặn/Bỏ chặn
//
// CÁC CHỖ DỄ SAI (đều có kiểm tra):
//   - Backend trả MỚI NHẤT TRƯỚC; getMessageHistory() đã sắp lại cũ -> mới.
//   - partnerId đi thẳng vào câu SQL uuid ở backend (/messages/with/{id} không
//     tự kiểm tra định dạng) nên phải isUuid() trước, nếu không id rác -> 500.
//   - Tên/role người đối thoại: backend (GET /messages/conversations/{id}) là
//     nguồn đáng tin; ?name=&role= trên URL do BẤT KỲ ai dựng link cũng đặt
//     được ("Giám đốc"...) nên CHỈ là dự phòng khi API lỗi, role chỉ nhận 3
//     giá trị hợp lệ.
//   - Đánh dấu đã đọc CHỈ chạy khi lịch sử đã tải được (Flask luôn gọi, kể cả
//     khi tải lỗi -> tin chưa từng được nhìn thấy vẫn bị đánh "đã đọc").
//     Chạy SAU khi có lịch sử (không song song) để tin đến giữa chừng không bị
//     đánh dấu đã đọc mà chưa hiện; lỗi bước này bị nuốt (plan).
//   - key={partnerId} ở ChatMessageList: đi từ thread A sang thread B giữ
//     nguyên instance component -> không có key thì state cũ (tin của A) còn lại.
//
// requireUser(): mọi role đăng nhập đều vào được (Flask @login_required).
// force-dynamic: nội dung đổi từng giây, không được cache.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import {
  describeMessagesError,
  getConversation,
  getMessageHistory,
  isPartnerNotFound,
  markMessagesRead,
  type ChatMessageOut,
} from "@/lib/api/messages";
import { ChatMessageList, type ChatMessageView } from "@/components/chat-message-list";
import { ROLE_LABELS } from "@/lib/constants";
import { formatMessageTimeVN } from "@/lib/date";
import { PARTNER_NAME_FROM_URL_MAX, firstParam, isSameUserId, isUuid } from "@/lib/messages";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tin nhắn — MindX Career Hub",
};

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<{ name?: string | string[]; role?: string | string[] }>;
}) {
  const user = await requireUser();
  const { partnerId } = await params;
  const sp = await searchParams;

  // Chặn tự chat với chính mình + id không phải UUID TRƯỚC khi chạm backend
  // (plan: lớp double-check, không phải lớp chặn thật duy nhất — backend
  // cũng trả 400 cho trường hợp tự chat).
  if (!isUuid(partnerId) || isSameUserId(partnerId, user.ss_user_id)) notFound();

  const [historyRes, partnerRes] = await Promise.allSettled([
    getMessageHistory(partnerId),
    getConversation(partnerId),
  ]);

  // 404 đúng mã = không tồn tại / không được phép thấy người này (vd học viên
  // mở thread với học viên khác) và không có lịch sử nào để che mất.
  if (partnerRes.status === "rejected" && isPartnerNotFound(partnerRes.reason)) notFound();

  // Mọi lỗi KHÁC (429, 5xx, mạng) KHÔNG chặn xem lịch sử (plan) -> rơi về
  // tên/role trên URL, không có nữa thì "Người dùng".
  const partner = partnerRes.status === "fulfilled" ? partnerRes.value : null;
  const urlName = firstParam(sp.name).trim().slice(0, PARTNER_NAME_FROM_URL_MAX);
  const urlRole = firstParam(sp.role).trim();
  const partnerName = partner?.partner_name || urlName || "Người dùng";
  const partnerRole = partner
    ? partner.partner_role
    : Object.hasOwn(ROLE_LABELS, urlRole) // hasOwn: "toString" in {} là true
      ? urlRole
      : "";

  let messages: ChatMessageOut[] = [];
  let historyError: string | null = null;
  if (historyRes.status === "fulfilled") {
    messages = historyRes.value;
    try {
      await markMessagesRead(partnerId);
    } catch {
      // Nuốt: không đáng làm hỏng cả trang chat chỉ vì đánh dấu đã đọc lỗi.
    }
  } else {
    historyError = describeMessagesError(historyRes.reason, "Không tải được lịch sử tin nhắn.");
  }

  const initialMessages: ChatMessageView[] = messages.map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    content: m.content,
    timeLabel: formatMessageTimeVN(m.created_at),
  }));

  // Câu trạng thái rỗng khớp messages_thread.html. Lúc tải lịch sử lỗi KHÔNG
  // hiện (null) — "chưa có tin nhắn" lúc đó là thông tin sai.
  const emptyText = historyError
    ? null
    : user.is_staff
      ? `Chưa có tin nhắn nào. Nhắn trước cho ${partnerName} — hội thoại sẽ tự mở, không cần chờ chấp nhận.`
      : `Chưa có tin nhắn nào. Gửi tin đầu tiên bên dưới để tạo yêu cầu nhắn tin tới ${partnerName}.`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/messages" className="text-sm text-muted-foreground hover:text-foreground">
            ← Tin nhắn
          </Link>
          {/* Text thuần (JSX tự escape) — tên do người dùng đặt. */}
          <h1 className="mt-1 flex flex-wrap items-center gap-2.5 break-words font-heading text-3xl font-semibold">
            {partnerName}
            {partnerRole && (
              <span className="inline-block rounded-full bg-muted px-2 py-[2px] font-sans text-xs font-normal">
                {ROLE_LABELS[partnerRole] ?? partnerRole}
              </span>
            )}
          </h1>
        </div>
        {/* Phần 3/3: nút Chặn/Bỏ chặn học viên (cần relationship_status/_id
            từ `partner`, đã tải sẵn ở trên). */}
      </header>

      {historyError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {historyError}
        </p>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <ChatMessageList
          key={partnerId}
          initialMessages={initialMessages}
          viewerId={user.ss_user_id}
          partnerName={partnerName}
          emptyText={emptyText}
        />
      </div>
    </div>
  );
}
