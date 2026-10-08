// lib/api/messages.ts
// Tương đương phần list_conversations / list_pending_requests / search_people
// / accept|decline|block|unblock / get_message_history / mark_messages_read
// của backend_auth.py bên Flask. Nhóm 4 (Messages). Phần 1/3: danh sách +
// quản lý quan hệ. Phần 2/3 (nửa đầu): getConversation, getMessageHistory,
// markMessagesRead. Phần 2/3 (nửa sau): getMessagesSince (polling). Phần 3/3:
// sendMessage (gửi tin) + cancelMessageRequest (học viên huỷ request).
//
// Mọi hàm đi qua callAuthed() (JWT bắt buộc, mặc định no-store). Rate limit
// backend NHỎ so với các route khác: GET /conversations và /pending-requests
// chỉ 10 lần/phút/người, search-people 20/phút -> mở lại trang liên tục sẽ
// dính 429. describeMessagesError() đổi 429 thành câu tiếng Việt dễ hiểu
// thay vì "Lỗi không xác định" (ApiError của 429 không có message riêng).

import { ApiError, callAuthed } from "./client";
import type { components } from "./types";

export type ConversationOut = components["schemas"]["ConversationOut"];
export type PendingRequestOut = components["schemas"]["PendingRequestOut"];
export type PersonSearchResult = components["schemas"]["PersonSearchResult"];
export type RelationshipOut = components["schemas"]["RelationshipOut"];
export type ChatMessageOut = components["schemas"]["ChatMessageOut"];

/** Số tin tải cho 1 lần mở thread — khớp limit=50 của Flask (thread()). */
export const MESSAGE_HISTORY_PAGE_SIZE = 50;

/** error_code backend gắn cho 404 của GET /messages/conversations/{id}. */
export const PARTNER_NOT_FOUND_CODE = "message_partner_not_found";

/** error_code của 429 RIÊNG khi học viên có quá nhiều request đang chờ (khác
 *  429 rate limit chung, vốn không có error_code). */
export const TOO_MANY_PENDING_CODE = "message_too_many_pending_requests";

/** Backend ràng buộc q: 1..100 ký tự (Query min_length=1, max_length=100). */
export const SEARCH_PEOPLE_MAX_LENGTH = 100;

/** Message lỗi hiển thị cho người dùng; 429 rate limit chung có câu riêng, còn
 *  lại dùng message backend (đã là tiếng Việt) hoặc `fallback`.
 *
 *  429 CÓ error_code (MESSAGE_TOO_MANY_PENDING_REQUESTS — học viên có quá nhiều
 *  request đang chờ) KHÔNG phải rate limit: message backend nêu rõ giới hạn và
 *  việc cần làm, plan Nhóm 4 yêu cầu hiện nguyên văn thay vì câu "thao tác quá
 *  nhanh" gây hiểu nhầm. Chỉ 429 KHÔNG có error_code mới là rate limit. */
export function describeMessagesError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429 && !err.errorCode) {
      return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.";
    }
    // "Lỗi không xác định" là message mặc định của lỗi hạ tầng (Dạng 3 ở
    // client.ts) — không có thông tin gì, dùng fallback cụ thể của nơi gọi.
    if (err.message && err.message !== "Lỗi không xác định") return err.message;
  }
  return fallback;
}

/** GET /messages/conversations — hội thoại ĐÃ CÓ tin nhắn của người gọi. */
export async function listConversations(): Promise<ConversationOut[]> {
  return (await callAuthed<ConversationOut[]>("/messages/conversations")) ?? [];
}

/** GET /messages/pending-requests — CHỈ SS/admin (học viên gọi sẽ 403, nơi
 *  gọi không được gọi hàm này cho học viên). */
export async function listPendingRequests(): Promise<PendingRequestOut[]> {
  return (await callAuthed<PendingRequestOut[]>("/messages/pending-requests")) ?? [];
}

/** GET /messages/search-people — backend tự lọc theo role người tìm (học
 *  viên chỉ thấy ss_team/admin), KHÔNG lọc lại ở đây (plan Nhóm 4). */
export async function searchPeople(q: string): Promise<PersonSearchResult[]> {
  const params = new URLSearchParams({ q: q.slice(0, SEARCH_PEOPLE_MAX_LENGTH) });
  return (await callAuthed<PersonSearchResult[]>(`/messages/search-people?${params}`)) ?? [];
}

/** POST /messages/relationships/{id}/accept — chỉ ss_id sở hữu quan hệ. */
export async function acceptMessageRequest(relationshipId: string): Promise<RelationshipOut> {
  return callAuthed<RelationshipOut>(
    `/messages/relationships/${encodeURIComponent(relationshipId)}/accept`,
    { method: "POST" },
  );
}

/** POST /messages/relationships/{id}/decline — áp cooldown cho học viên. */
export async function declineMessageRequest(relationshipId: string): Promise<RelationshipOut> {
  return callAuthed<RelationshipOut>(
    `/messages/relationships/${encodeURIComponent(relationshipId)}/decline`,
    { method: "POST" },
  );
}

/** POST /messages/block/{student_id} — biến thể theo student_id (không cần
 *  relationship_id, chặn được cả học viên chưa từng có quan hệ). */
export async function blockStudentInChat(studentId: string): Promise<RelationshipOut> {
  return callAuthed<RelationshipOut>(`/messages/block/${encodeURIComponent(studentId)}`, {
    method: "POST",
  });
}

/** POST /messages/relationships/{id}/unblock — cần relationship_id lấy từ
 *  ConversationOut (chỉ có khi đã từng nhắn qua lại, xem plan Nhóm 4). */
export async function unblockMessageRelationship(relationshipId: string): Promise<RelationshipOut> {
  return callAuthed<RelationshipOut>(
    `/messages/relationships/${encodeURIComponent(relationshipId)}/unblock`,
    { method: "POST" },
  );
}

/**
 * GET /messages/conversations/{partner_id} — tra ĐÚNG 1 người đối thoại: tên,
 * role, relationship_status, relationship_id, kể cả khi 2 bên chưa từng nhắn
 * (khi đó các field quan hệ = null). Thay cho việc tin vào ?name=&role= trên
 * URL và cho việc staff phải kéo cả /conversations (giới hạn 10 lần/phút)
 * chỉ để lấy quan hệ của 1 người — plan mục 9 (đề xuất endpoint này).
 *
 * 404 nghĩa là "không tồn tại HOẶC bạn không được phép thấy người này" (backend
 * cố ý gộp để không lộ user_id nào có thật); nếu 2 bên đã có tin/quan hệ thì
 * endpoint này luôn tìm thấy, nên 404 không bao giờ che mất 1 lịch sử có thật.
 */
export async function getConversation(partnerId: string): Promise<ConversationOut> {
  return callAuthed<ConversationOut>(`/messages/conversations/${encodeURIComponent(partnerId)}`);
}

/**
 * Chỉ true với ĐÚNG 404 mang mã MESSAGE_PARTNER_NOT_FOUND. Cố ý KHÔNG coi mọi
 * 404 là "không tìm thấy người": backend cũ chưa có route này cũng trả 404
 * (body dạng chuỗi, không có error_code) và khi đó TOÀN BỘ thread sẽ thành
 * trang 404 oan.
 */
export function isPartnerNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404 && err.errorCode === PARTNER_NOT_FOUND_CODE;
}

/**
 * GET /messages/with/{partner_id}?limit= — lịch sử 2 người, backend trả MỚI
 * NHẤT TRƯỚC (ORDER BY id DESC, tối ưu cho cursor before_id). Hàm này đã sắp
 * lại thành CŨ -> MỚI (id tăng dần) để khớp chiều đọc trên -> dưới; nơi gọi
 * không được tự đảo thêm lần nữa. Sắp theo id chứ không đảo mảng, để vẫn đúng
 * dù backend đổi thứ tự trả về.
 *
 * Cho xem kể cả khi quan hệ đang declined/blocked (backend chỉ chặn GỬI).
 */
export async function getMessageHistory(
  partnerId: string,
  limit: number = MESSAGE_HISTORY_PAGE_SIZE,
): Promise<ChatMessageOut[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const rows =
    (await callAuthed<ChatMessageOut[]>(
      `/messages/with/${encodeURIComponent(partnerId)}?${params}`,
    )) ?? [];
  return [...rows].sort((a, b) => a.id - b.id);
}

/** POST /messages/read/{partner_id} — đánh dấu mọi tin partner gửi cho mình
 *  là đã đọc. Nơi gọi tự nuốt lỗi (plan: thao tác phụ không được làm hỏng
 *  trang chat). */
export async function markMessagesRead(partnerId: string): Promise<void> {
  await callAuthed<unknown>(`/messages/read/${encodeURIComponent(partnerId)}`, {
    method: "POST",
  });
}

/**
 * GET /messages/since/{partner_id}?after_id= — chỉ tin có id > after_id, backend
 * trả CŨ -> MỚI (ORDER BY id ASC). Vẫn sắp lại theo id cho chắc, giống
 * getMessageHistory(). Gọi từ Route Handler polling (app/api/messages/since),
 * không gọi trực tiếp từ component.
 */
export async function getMessagesSince(
  partnerId: string,
  afterId: number,
): Promise<ChatMessageOut[]> {
  const params = new URLSearchParams({ after_id: String(afterId) });
  const rows =
    (await callAuthed<ChatMessageOut[]>(
      `/messages/since/${encodeURIComponent(partnerId)}?${params}`,
    )) ?? [];
  return [...rows].sort((a, b) => a.id - b.id);
}

/** Kết quả POST /messages — 2 shape khác nhau cho cùng 1 route. */
export type SendMessageResult =
  | { kind: "message"; message: ChatMessageOut }
  | { kind: "pending_request"; notice: string };

/**
 * POST /messages — gửi tin. receiver_id + content; sender_id backend tự lấy từ
 * JWT. 2 shape response:
 *   - 201 ChatMessageOut          -> tin đã lưu thật   (kind "message")
 *   - 202 {status:"pending",...}  -> học viên vừa TẠO/GỬI LẠI request, CHƯA có
 *                                    tin nào được lưu   (kind "pending_request")
 *
 * LỆCH SO VỚI PLAN (đã báo trong ghi chú giao việc): plan bảo phân biệt bằng
 * HTTP status, nhưng callAuthed() chỉ trả body JSON, không lộ status, và plan
 * cấm viết lại logic refresh ngoài callAuthed. Thay vào đó dùng field `kind`
 * mà backend đã thêm đúng cho mục đích này (plan 3.15; xác nhận trong
 * api/routers/messages.py: cả 201 lẫn 202 đều mang `kind`). Vẫn rẽ nhánh theo
 * `kind` tường minh, KHÔNG đoán theo "có field id hay không" khi `kind` có mặt;
 * chỉ khi `kind` vắng (backend cũ) mới dựa vào dạng body, và body không khớp
 * dạng nào thì ném lỗi chứ không đoán bừa — nhầm 202 thành tin đã gửi sẽ khiến
 * học viên tin rằng SS đã nhận được tin.
 */
export async function sendMessage(receiverId: string, content: string): Promise<SendMessageResult> {
  const body = await callAuthed<Record<string, unknown> | null>("/messages", {
    method: "POST",
    body: JSON.stringify({ receiver_id: receiverId, content }),
  });

  const kind = body?.kind;
  const isPending =
    kind === "pending_request" || (kind === undefined && body?.status === "pending");
  if (isPending) {
    const notice = typeof body?.message === "string" && body.message ? body.message : "";
    return {
      kind: "pending_request",
      notice: notice || "Đã gửi yêu cầu nhắn tin — chờ SS chấp nhận trước khi có thể nhắn tiếp.",
    };
  }

  const isMessage =
    kind === "message" ||
    (kind === undefined && typeof body?.id === "number" && typeof body?.content === "string");
  if (isMessage) return { kind: "message", message: body as unknown as ChatMessageOut };

  console.error("[api] POST /messages: phản hồi không khớp dạng nào đã biết", body);
  throw new ApiError("Phản hồi gửi tin nhắn không hợp lệ.");
}

/**
 * POST /messages/cancel/{ss_id} — học viên TỰ HUỶ request đang pending do chính
 * mình tạo. Backend xoá hẳn dòng quan hệ (không cooldown), nên body trả về chỉ
 * để hiện thông báo, không dùng để tra cứu lại. 404 = không có request pending
 * để huỷ; 409 = SS vừa kịp xử lý.
 */
export async function cancelMessageRequest(ssId: string): Promise<RelationshipOut> {
  return callAuthed<RelationshipOut>(`/messages/cancel/${encodeURIComponent(ssId)}`, {
    method: "POST",
  });
}
