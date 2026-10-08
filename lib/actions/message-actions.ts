"use server";

// lib/actions/message-actions.ts
// Server action của Messages — Nhóm 4:
//   - Phần 1/3: quản lý quan hệ nhắn tin (accept / decline / block / unblock)
//   - Phần 3/3: gửi tin (sendMessageAction) + học viên huỷ request
//     (cancelMessageRequestAction)
//
// 4 action quan hệ: requireStaff() ở ĐẦU mỗi action (plan Nhóm 4: "requireStaff() là đủ, không
// cần admin" — khớp @staff_required của Flask): ẩn nút ở UI KHÔNG thay thế
// được check này vì server action gọi được bằng POST tay.
//
// Cờ `stale`: backend trả 404/409 khi quan hệ đã đổi trạng thái do thao tác
// khác (SS khác/học viên vừa huỷ). Khi đó trang đang hiện dữ liệu cũ nên
// nơi gọi phải router.refresh() dù action báo lỗi.

import { revalidatePath } from "next/cache";
import { requireStaff, requireStudent, requireUser } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import {
  acceptMessageRequest,
  blockStudentInChat,
  cancelMessageRequest,
  declineMessageRequest,
  describeMessagesError,
  sendMessage,
  unblockMessageRelationship,
} from "@/lib/api/messages";
import {
  isSameUserId,
  isUuid,
  toChatMessageView,
  validateMessageContent,
  type ChatMessageView,
} from "@/lib/messages";

export interface MessageActionResult {
  ok: boolean;
  message: string;
  /** true = dữ liệu trên trang đã cũ (404/409) -> nơi gọi nên refresh. */
  stale?: boolean;
}

async function runRelationshipAction(
  id: string,
  call: (id: string) => Promise<unknown>,
  successMessage: string,
  errorFallback: string,
): Promise<MessageActionResult> {
  await requireStaff();

  if (!isUuid(id)) return { ok: false, message: errorFallback };

  try {
    await call(id);
    revalidatePath("/messages");
    return { ok: true, message: successMessage };
  } catch (err) {
    const stale = err instanceof ApiError && (err.status === 404 || err.status === 409);
    if (stale) revalidatePath("/messages");
    return { ok: false, message: describeMessagesError(err, errorFallback), stale };
  }
}

/** Chấp nhận yêu cầu nhắn tin của 1 học viên (relationship_id lấy từ
 *  PendingRequestOut). Thông báo khớp flash của Flask. */
export async function acceptMessageRequestAction(relationshipId: string): Promise<MessageActionResult> {
  return runRelationshipAction(
    relationshipId,
    acceptMessageRequest,
    "Đã chấp nhận yêu cầu nhắn tin.",
    "Không thể chấp nhận yêu cầu, thử lại sau.",
  );
}

/** Từ chối yêu cầu — học viên bị áp cooldown gửi lại (backend lo). */
export async function declineMessageRequestAction(relationshipId: string): Promise<MessageActionResult> {
  return runRelationshipAction(
    relationshipId,
    declineMessageRequest,
    "Đã từ chối yêu cầu nhắn tin.",
    "Không thể từ chối yêu cầu, thử lại sau.",
  );
}

/** Chặn học viên theo student_id (không cần relationship_id nên chặn được
 *  cả học viên chưa từng có quan hệ). */
export async function blockStudentAction(studentId: string): Promise<MessageActionResult> {
  return runRelationshipAction(
    studentId,
    blockStudentInChat,
    "Đã chặn học viên này — họ sẽ không nhắn tin được cho bạn nữa.",
    "Không thể chặn học viên này, thử lại sau.",
  );
}

/** Bỏ chặn — cần relationship_id (ConversationOut.relationship_id). */
export async function unblockStudentAction(relationshipId: string): Promise<MessageActionResult> {
  return runRelationshipAction(
    relationshipId,
    unblockMessageRelationship,
    "Đã bỏ chặn — học viên nhắn tin lại được với bạn.",
    "Không thể bỏ chặn học viên này, thử lại sau.",
  );
}

// ============================================================
// Phần 3/3 — gửi tin + huỷ request
// ============================================================

/**
 * Kết quả gửi tin. 2 nhánh THÀNH CÔNG khác bản chất (plan Nhóm 4: "hiện tin
 * nhắn thật" vs "hiện toast đã gửi yêu cầu, đợi SS phản hồi"):
 *   - kind "message": tin đã lưu thật -> `message` để chèn vào khung chat.
 *   - kind "pending_request": CHƯA có tin nào được lưu (học viên vừa tạo/gửi
 *     lại request) -> chỉ có câu thông báo, KHÔNG được chèn gì vào khung chat.
 */
export type SendMessageActionResult =
  | { ok: true; kind: "message"; message: ChatMessageView }
  | { ok: true; kind: "pending_request"; message: string }
  | {
      ok: false;
      message: string;
      /** true = trạng thái quan hệ trên trang có thể đã cũ (403 bị chặn/cooldown,
       *  409 đang chờ) -> nơi gọi nên router.refresh(). */
      stale?: boolean;
    };

/**
 * Gửi 1 tin tới `partnerId`. requireUser(): học viên LẪN staff đều gửi được
 * (Flask @login_required); luật ai được nhắn ai nằm hết ở backend (state
 * machine), action này không tự lặp lại.
 *
 * Các check ở đây chỉ là double-check tránh round-trip vô ích (plan): id không
 * phải UUID, tự nhắn cho chính mình, nội dung rỗng/quá dài. Server action gọi
 * được bằng POST tay nên KHÔNG tin client đã kiểm tra.
 *
 * Lỗi KHÔNG có error_code ở 429 (rate limit 1 tin/giây, 20 tin/phút) đổi thành
 * câu "thao tác quá nhanh"; 429 CÓ error_code (quá nhiều request đang chờ) giữ
 * nguyên message của backend — xem describeMessagesError().
 */
export async function sendMessageAction(
  partnerId: string,
  content: string,
): Promise<SendMessageActionResult> {
  const user = await requireUser();

  if (!isUuid(partnerId)) return { ok: false, message: "Không tìm thấy người nhận." };
  if (isSameUserId(partnerId, user.ss_user_id)) {
    return { ok: false, message: "Không thể tự nhắn tin cho chính mình." };
  }
  if (typeof content !== "string") return { ok: false, message: "Nội dung tin nhắn không hợp lệ." };
  const invalid = validateMessageContent(content);
  if (invalid) return { ok: false, message: invalid };

  try {
    const result = await sendMessage(partnerId, content.trim());
    if (result.kind === "pending_request") {
      return { ok: true, kind: "pending_request", message: result.notice };
    }
    return { ok: true, kind: "message", message: toChatMessageView(result.message) };
  } catch (err) {
    const stale = err instanceof ApiError && (err.status === 403 || err.status === 409);
    return {
      ok: false,
      message: describeMessagesError(err, "Không gửi được tin nhắn, vui lòng thử lại."),
      stale,
    };
  }
}

/**
 * Học viên tự huỷ request nhắn tin đang chờ tới 1 SS (Flask: cancel()).
 * requireStudent() khớp `if not current_user.is_student: abort(403)` — nút chỉ
 * hiện cho học viên nhưng action gọi được bằng POST tay nên vẫn phải chặn
 * (plan Nhóm 4). Backend cũng tự 403 nếu SS gọi nhầm.
 *
 * Huỷ xoá hẳn dòng quan hệ, KHÔNG áp cooldown -> học viên gửi lại được ngay.
 * 404/409 = request không còn ở trạng thái pending (SS vừa xử lý): trang đã cũ.
 */
export async function cancelMessageRequestAction(ssId: string): Promise<MessageActionResult> {
  await requireStudent();

  const fallback = "Không thể huỷ yêu cầu nhắn tin, thử lại sau.";
  if (!isUuid(ssId)) return { ok: false, message: fallback };

  try {
    await cancelMessageRequest(ssId);
    revalidatePath("/messages");
    return { ok: true, message: "Đã huỷ yêu cầu nhắn tin." };
  } catch (err) {
    const stale = err instanceof ApiError && (err.status === 404 || err.status === 409);
    if (stale) revalidatePath("/messages");
    return { ok: false, message: describeMessagesError(err, fallback), stale };
  }
}
