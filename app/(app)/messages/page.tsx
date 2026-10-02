// app/(app)/messages/page.tsx
// Tương đương messages.html + blueprints/messages.py::inbox() (Flask) —
// danh sách hội thoại + (riêng SS/admin) mục "Yêu cầu đang chờ". Nhóm 4
// (Messages), LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/3 — /messages (file này) + /messages/new + accept/decline/
//                  block/unblock
//   [ ] Phần 2/3 — /messages/[partnerId] chỉ xem + polling nhận tin
//   [ ] Phần 3/3 — gửi tin (optimistic) + huỷ request + chặn trong khung chat
//
// requireUser(): mọi role đăng nhập đều vào được (Flask @login_required).
// 4 nút quản lý quan hệ chỉ render cho staff và server action tự
// requireStaff() lại (plan Nhóm 4).
//
// Lỗi tải KHÔNG bị coi là "chưa có gì": Flask flash lỗi rồi vẫn hiện "Chưa
// có hội thoại nào" như thể danh sách thật sự rỗng. Ở đây khi tải lỗi chỉ
// hiện banner, không hiện empty state (tránh người dùng tưởng mất tin nhắn).
// 2 API tải song song bằng Promise.allSettled: 1 bên lỗi không làm mất bên
// kia. Rate limit backend chỉ 10 lần/phút cho mỗi API — quá thì 429, đã đổi
// thành câu tiếng Việt ở describeMessagesError().
// force-dynamic: số tin chưa đọc/yêu cầu chờ phải luôn mới.

import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import {
  describeMessagesError,
  listConversations,
  listPendingRequests,
  type ConversationOut,
  type PendingRequestOut,
} from "@/lib/api/messages";
import { buttonVariants } from "@/components/ui/button";
import { MessageRequestActions } from "@/components/message-request-actions";
import { ConversationBlockButton } from "@/components/conversation-block-button";
import { ROLE_LABELS, RELATIONSHIP_STATUS_LABELS } from "@/lib/constants";
import { formatDateTimeVN, formatShortDateTimeVN } from "@/lib/date";
import { avatarInitial, buildThreadHref, formatUnreadCount } from "@/lib/messages";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tin nhắn — MindX Career Hub",
};

// Màu chip trạng thái — khớp .status-pending/-declined/-blocked trong
// 18-messages.css. Trạng thái lạ rơi về màu trung tính.
const STATUS_CHIP_CLASS: Record<string, string> = {
  pending: "bg-[var(--brand-amber-soft)] text-[var(--brand-amber)]",
  declined: "bg-[#F1EDF0] text-[#8A6E80]",
  blocked: "bg-[#FBE7E4] text-[#B23A22]",
};

export default async function MessagesPage() {
  const user = await requireUser();

  const [convRes, pendingRes] = await Promise.allSettled([
    listConversations(),
    user.is_staff ? listPendingRequests() : Promise.resolve<PendingRequestOut[]>([]),
  ]);

  const errors: string[] = [];
  const conversations: ConversationOut[] = convRes.status === "fulfilled" ? convRes.value : [];
  if (convRes.status === "rejected") {
    errors.push(describeMessagesError(convRes.reason, "Không tải được danh sách hội thoại."));
  }
  const pendingRequests: PendingRequestOut[] = pendingRes.status === "fulfilled" ? pendingRes.value : [];
  if (pendingRes.status === "rejected") {
    errors.push(describeMessagesError(pendingRes.reason, "Không tải được danh sách yêu cầu đang chờ."));
  }

  const showPending = user.is_staff && pendingRequests.length > 0;
  const showEmptyState = convRes.status === "fulfilled" && conversations.length === 0 && !showPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Nhắn tin</span>
          <h1 className="font-heading text-3xl font-semibold">Tin nhắn</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {user.is_staff
              ? "Hội thoại với học viên và team SS khác. Yêu cầu nhắn tin mới từ học viên sẽ hiện ở mục riêng bên dưới."
              : "Hội thoại với team SS. Gửi yêu cầu nhắn tin mới nếu chưa từng liên hệ với ai đó."}
          </p>
        </div>
        <Link href="/messages/new" className={buttonVariants()}>
          ✎ Nhắn tin mới
        </Link>
      </header>

      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      {showPending && (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Yêu cầu đang chờ ({pendingRequests.length})</h2>
          <div className="flex flex-col gap-2">
            {pendingRequests.map((req) => (
              <div
                key={req.relationship_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-card px-[18px] py-3.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* Text thuần (JSX tự escape) — tên do người dùng đặt. */}
                  <strong>{req.student_name}</strong>
                  <span className="text-[12.5px] text-[var(--brand-ink-soft)]">
                    Gửi lúc {formatDateTimeVN(req.requested_at)}
                  </span>
                </div>
                <MessageRequestActions relationshipId={req.relationship_id} studentName={req.student_name} />
              </div>
            ))}
          </div>
        </section>
      )}

      {conversations.length > 0 && (
        <section className="space-y-3">
          {showPending && <h2 className="font-heading text-base font-semibold">Hội thoại</h2>}
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => {
              const hasUnread = conv.unread_count > 0;
              const status = conv.relationship_status;
              return (
                <div
                  key={conv.partner_id}
                  className="flex items-center rounded-[var(--radius)] border border-border bg-card"
                >
                  <Link
                    href={buildThreadHref(conv.partner_id, conv.partner_name, conv.partner_role)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[var(--radius)] px-[18px] py-3.5 hover:bg-muted"
                  >
                    <div
                      aria-hidden="true"
                      className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue-soft)] text-[15px] font-bold text-[var(--brand-blue)]"
                    >
                      {avatarInitial(conv.partner_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <strong className={hasUnread ? "font-bold" : "font-semibold"}>{conv.partner_name}</strong>
                        <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-xs">
                          {ROLE_LABELS[conv.partner_role] ?? conv.partner_role}
                        </span>
                        {status && status !== "accepted" && (
                          <span
                            className={
                              "inline-block rounded-full px-2 py-[2px] text-xs " +
                              (STATUS_CHIP_CLASS[status] ?? "bg-muted text-muted-foreground")
                            }
                          >
                            {RELATIONSHIP_STATUS_LABELS[status] ?? status}
                          </span>
                        )}
                      </div>
                      {/* Text thuần: preview là nội dung tin do người dùng nhập. */}
                      <p
                        className={
                          "m-0 truncate text-[13px] " +
                          (hasUnread ? "font-bold text-foreground" : "text-[var(--brand-ink-soft)]")
                        }
                      >
                        {conv.last_message_preview || "—"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11.5px] text-muted-foreground">
                        {formatShortDateTimeVN(conv.last_message_at)}
                      </span>
                      {hasUnread && (
                        <span
                          aria-label={`${conv.unread_count} tin chưa đọc`}
                          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-accent)] px-[5px] text-[10.5px] font-bold text-white"
                        >
                          {formatUnreadCount(conv.unread_count)}
                        </span>
                      )}
                    </div>
                  </Link>

                  {user.is_staff && conv.partner_role === "user" && (
                    <ConversationBlockButton
                      studentId={conv.partner_id}
                      studentName={conv.partner_name}
                      blocked={status === "blocked"}
                      relationshipId={conv.relationship_id ?? null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showEmptyState && (
        <div className="space-y-3 rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <p>Chưa có hội thoại nào.</p>
          <Link href="/messages/new" className={buttonVariants()}>
            Bắt đầu nhắn tin mới
          </Link>
        </div>
      )}
    </div>
  );
}
