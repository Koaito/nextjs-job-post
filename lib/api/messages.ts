// lib/api/messages.ts
// Tương đương phần list_conversations / list_pending_requests / search_people
// / accept|decline|block|unblock của backend_auth.py bên Flask. Nhóm 4
// (Messages), Phần 1/3. Phần 2/3 sẽ thêm lịch sử + polling, Phần 3/3 thêm
// gửi tin + huỷ request.
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

/** Backend ràng buộc q: 1..100 ký tự (Query min_length=1, max_length=100). */
export const SEARCH_PEOPLE_MAX_LENGTH = 100;

/** Message lỗi hiển thị cho người dùng; 429 có câu riêng, còn lại dùng
 *  message backend (đã là tiếng Việt) hoặc `fallback`. */
export function describeMessagesError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.";
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
