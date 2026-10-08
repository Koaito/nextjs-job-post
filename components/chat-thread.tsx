"use client";
// components/chat-thread.tsx
// Toàn bộ phần TƯƠNG TÁC của khung chat /messages/[partnerId]: giữ state danh
// sách tin, polling nhận tin mới, quy tắc cuộn `wasAtBottom`, gửi tin
// (optimistic) và nút huỷ request của học viên. Thay initChatPolling() trong
// app.js + form gửi/huỷ của messages_thread.html bên Flask.
// Nhóm 4 (Messages), Phần 2/3 nửa sau + Phần 3/3.
//
// ─────────────────────────────── NHẬN TIN (polling) ───────────────────────────
// Plan: dùng useSWR polling làm cơ chế chính, gọi GET /messages/since qua Route
// Handler app/api/messages/since/[partnerId]. Giữ đúng vòng đời createPoller()
// của app.js:
//   - Poll mỗi 5s (CHAT_BASE_INTERVAL)               -> refreshInterval
//   - Lỗi liên tiếp: giãn gấp đôi, trần 30s           -> onErrorRetry
//     (5s -> 10s -> 20s -> 30s...), thành công 1 lần là về lại 5s
//   - Nhận 401 thì dừng HẲN                           -> setStopped + key = null
//   - Chỉ poll khi tab đang hiện                      -> refreshWhenHidden=false;
//     quay lại tab thì revalidateOnFocus gọi ngay (= visibilitychange -> tick())
// Mở trang KHÔNG poll ngay (revalidateOnMount=false): server vừa tải xong lịch
// sử, lần poll đầu là sau 5s như Flask.
//
// Key SWR có thêm useId(): cache SWR sống ngoài component, nếu rời thread lúc
// đang lỗi rồi quay lại cùng thread thì lỗi cũ còn trong cache và timer của SWR
// bỏ qua mọi lần poll khi cache đang có lỗi -> polling chết âm thầm. Mỗi lần
// mount dùng key riêng thì không dính chuyện này.
//
// ───────────────────────────── `wasAtBottom` ──────────────────────────────────
// Chỉ tự cuộn xuống cuối khi có tin mới VÀ người đọc đang ở cuối (cách đáy
// <= 40px, đo NGAY TRƯỚC khi chèn tin — đúng công thức app.js). Đang đọc tin cũ
// thì không kéo họ xuống. 2 ngoại lệ luôn cuộn xuống: lúc mở trang, và khi
// CHÍNH MÌNH vừa gửi (Flask reload cả trang nên tự về cuối).
//
// ───────────────────────────────── GỬI TIN ────────────────────────────────────
// Plan: server action + optimistic update (hiện tin ngay, lỗi thì gỡ + khôi phục
// chữ), KHÔNG copy kiểu full-reload của Flask. 2 điểm cần cẩn thận:
//
//   1. 201 vs 202. Học viên gửi lần đầu (hoặc gửi lại sau declined hết
//      cooldown) KHÔNG tạo tin nào — chỉ tạo request chờ SS duyệt (202). Hiện
//      bong bóng tạm rồi gỡ đi sẽ trông như tin "biến mất", nên chỉ vẽ tin tạm
//      khi `optimisticSend` = true (page.tsx quyết định từ trạng thái quan hệ:
//      staff chưa chặn, hoặc học viên đã được accept). Nhánh 202 chỉ hiện toast.
//
//   2. KHÔNG nâng lastId theo tin vừa gửi. Giả sử đang biết tới id 10, đối
//      phương gửi id 11, mình gửi id 12: nếu lastId nhảy lên 12 thì lần poll
//      sau (after_id=12) bỏ sót id 11 vĩnh viễn. lastId chỉ tăng theo tin nhận
//      từ lịch sử/polling; tin của mình chèn vào danh sách theo id và poll trả
//      lại cùng tin đó thì bị loại trùng bằng knownIds.
//
// XSS: nội dung tin luôn là text thuần (xem chat-message-list.tsx).

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageList, type PendingChatMessage } from "@/components/chat-message-list";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { cancelMessageRequestAction, sendMessageAction } from "@/lib/actions/message-actions";
import type { ChatMessageView } from "@/lib/messages";
import { endSessionIfNeeded, readErrorCode } from "@/lib/session-end-client";

const BASE_INTERVAL_MS = 5_000; // khớp CHAT_BASE_INTERVAL
const MAX_INTERVAL_MS = 30_000; // khớp CHAT_MAX_INTERVAL
const BOTTOM_THRESHOLD_PX = 40; // khớp `scrollHeight - 40` của app.js

class SinceFetchError extends Error {
  constructor(
    public readonly status: number,
    /** error_code do Route Handler kèm theo (Phụ lục C), nếu có. */
    public readonly errorCode?: string,
  ) {
    super(`since request failed: ${status}`);
    this.name = "SinceFetchError";
  }
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof SinceFetchError && err.status === 401;
}

async function fetchMessagesSince(partnerId: string, afterId: number): Promise<ChatMessageView[]> {
  const res = await fetch(
    `/api/messages/since/${encodeURIComponent(partnerId)}?after_id=${afterId}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new SinceFetchError(res.status, await readErrorCode(res));
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ChatMessageView[]) : [];
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_THRESHOLD_PX;
}

function maxId(messages: ChatMessageView[]): number {
  return messages.reduce((max, m) => (m.id > max ? m.id : max), 0);
}

function byId(a: ChatMessageView, b: ChatMessageView): number {
  return a.id - b.id;
}

export function ChatThread({
  partnerId,
  partnerName,
  partnerRole,
  viewerId,
  viewerIsStudent,
  initialMessages,
  emptyText,
  optimisticSend,
}: {
  partnerId: string;
  partnerName: string;
  /** "" nếu không xác định được. */
  partnerRole: string;
  viewerId: string;
  viewerIsStudent: boolean;
  initialMessages: ChatMessageView[];
  /** null = KHÔNG hiện trạng thái rỗng (tải lịch sử lỗi). */
  emptyText: string | null;
  /** true = lần gửi tới đây chắc chắn tạo tin thật (không phải request chờ
   *  duyệt) nên được phép hiện tin tạm trước khi có phản hồi. */
  optimisticSend: boolean;
}) {
  const router = useRouter();
  const instanceId = useId();

  const [messages, setMessages] = useState(initialMessages);
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const [stopped, setStopped] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // true = lần render kế tiếp phải cuộn xuống cuối. Khởi tạo true để cuộn lúc mở.
  const stickRef = useRef(true);
  // Id lớn nhất NHẬN ĐƯỢC từ lịch sử/polling — mốc after_id cho lần poll kế tiếp.
  const lastIdRef = useRef(maxId(initialMessages));
  // Mọi id đang có trong danh sách, để loại trùng đồng bộ (không đợi setState).
  const knownIdsRef = useRef(new Set(initialMessages.map((m) => m.id)));
  const tempSeqRef = useRef(0);

  // useLayoutEffect (không phải useEffect) để cuộn TRƯỚC khi trình duyệt vẽ —
  // useEffect sẽ nháy tin cũ nhất rồi mới nhảy xuống cuối.
  useLayoutEffect(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingMessages]);

  /** Chèn tin đã lưu thật vào danh sách (loại trùng theo id, giữ thứ tự id).
   *  Trả true nếu có tin mới thật sự được thêm. */
  function addConfirmed(incoming: ChatMessageView[]): boolean {
    const fresh = incoming.filter((m) => !knownIdsRef.current.has(m.id));
    if (fresh.length === 0) return false;
    for (const m of fresh) knownIdsRef.current.add(m.id);
    setMessages((prev) => [...prev, ...fresh].sort(byId));
    return true;
  }

  useSWR<ChatMessageView[]>(
    stopped ? null : ["chat-since", partnerId, instanceId],
    () => fetchMessagesSince(partnerId, lastIdRef.current),
    {
      refreshInterval: BASE_INTERVAL_MS,
      refreshWhenHidden: false,
      revalidateOnMount: false,
      onSuccess: (data) => {
        if (data.length === 0) return;
        // Đo TRƯỚC khi chèn (công thức wasAtBottom của app.js).
        const el = containerRef.current;
        const wasAtBottom = !el || isNearBottom(el);
        for (const m of data) if (m.id > lastIdRef.current) lastIdRef.current = m.id;
        if (addConfirmed(data) && wasAtBottom) stickRef.current = true;
      },
      onError: (err) => {
        if (isUnauthorized(err)) {
          setStopped(true);
          // Bị đăng nhập nơi khác / phiên bị thu hồi -> báo + sang /login.
          endSessionIfNeeded(err.status, err.errorCode);
        }
      },
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        if (isUnauthorized(err)) return; // dừng hẳn
        // retryCount bắt đầu từ 1 ở lần retry đầu -> 10s, 20s, rồi chạm trần 30s.
        const delay = Math.min(BASE_INTERVAL_MS * 2 ** retryCount, MAX_INTERVAL_MS);
        setTimeout(() => revalidate({ retryCount }), delay);
      },
    },
  );

  /** Gửi 1 tin. Trả true nếu xong (kể cả nhánh 202), false nếu lỗi — ô nhập dựa
   *  vào đó để khôi phục chữ. */
  async function handleSend(content: string): Promise<boolean> {
    const tempId = `tmp-${++tempSeqRef.current}`;
    if (optimisticSend) {
      stickRef.current = true; // tin của chính mình: luôn cuộn xuống cuối
      setPendingMessages((prev) => [...prev, { tempId, content }]);
    }

    let result: Awaited<ReturnType<typeof sendMessageAction>>;
    try {
      result = await sendMessageAction(partnerId, content);
    } catch {
      result = { ok: false, message: "Không gửi được tin nhắn, kiểm tra kết nối rồi thử lại." };
    }

    // Gỡ tin tạm và (nếu có) thêm tin thật trong CÙNG 1 lượt cập nhật để không
    // có khoảnh khắc tin biến mất rồi hiện lại.
    if (optimisticSend) {
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
    }

    if (!result.ok) {
      toast.error(result.message);
      // Trạng thái quan hệ có thể đã đổi (bị chặn, đang chờ...): tải lại phần
      // server của trang để nút Chặn/Bỏ chặn khớp thực tế.
      if (result.stale) router.refresh();
      return false;
    }

    if (result.kind === "pending_request") {
      // Chưa có tin nào được lưu — chỉ báo "đã gửi yêu cầu, đợi SS phản hồi".
      toast.success(result.message);
      return true;
    }

    stickRef.current = true;
    addConfirmed([result.message]); // KHÔNG nâng lastIdRef — xem đầu file
    return true;
  }

  // Nút huỷ request: chỉ học viên, chỉ khi chưa có tin nào và đối phương là SS/
  // admin (khớp điều kiện của messages_thread.html). Server action vẫn tự chặn.
  const showCancel =
    viewerIsStudent &&
    messages.length === 0 &&
    (partnerRole === "ss_team" || partnerRole === "admin");

  return (
    <>
      <ChatMessageList
        containerRef={containerRef}
        messages={messages}
        pendingMessages={pendingMessages}
        viewerId={viewerId}
        partnerName={partnerName}
        emptyText={emptyText}
      />

      <ChatComposer onSend={handleSend} />

      {showCancel && (
        <div className="px-[18px] pb-4">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-[12.5px] text-muted-foreground"
            onClick={() => setCancelOpen(true)}
          >
            Đã gửi nhầm? Huỷ yêu cầu đang chờ (nếu có)
          </Button>

          <NoteConfirmDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            showNote={false}
            title="Huỷ yêu cầu nhắn tin?"
            description={
              <>
                Huỷ yêu cầu nhắn tin đang chờ tới <strong>{partnerName}</strong>? Bạn có thể gửi lại
                yêu cầu ngay sau đó.
              </>
            }
            confirmLabel="Huỷ yêu cầu"
            cancelLabel="Giữ lại"
            onConfirm={async () => {
              const result = await cancelMessageRequestAction(partnerId);
              if (result.ok) {
                toast.success(result.message);
                router.refresh();
              } else if (result.stale) {
                router.refresh();
              }
              return result;
            }}
          />
        </div>
      )}
    </>
  );
}
