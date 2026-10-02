"use server";

// lib/actions/message-actions.ts
// Server action quản lý quan hệ nhắn tin — Nhóm 4 (Messages), Phần 1/3:
// accept / decline / block / unblock. Phần 3/3 sẽ thêm gửi tin + huỷ request
// của học viên vào CÙNG file này.
//
// requireStaff() ở ĐẦU mỗi action (plan Nhóm 4: "requireStaff() là đủ, không
// cần admin" — khớp @staff_required của Flask): ẩn nút ở UI KHÔNG thay thế
// được check này vì server action gọi được bằng POST tay.
//
// Cờ `stale`: backend trả 404/409 khi quan hệ đã đổi trạng thái do thao tác
// khác (SS khác/học viên vừa huỷ). Khi đó trang đang hiện dữ liệu cũ nên
// nơi gọi phải router.refresh() dù action báo lỗi.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import {
  acceptMessageRequest,
  blockStudentInChat,
  declineMessageRequest,
  describeMessagesError,
  unblockMessageRelationship,
} from "@/lib/api/messages";
import { isUuid } from "@/lib/messages";

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
