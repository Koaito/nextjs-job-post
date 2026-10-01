"use server";

// lib/actions/audit-log-actions.ts
// Server action của /activity-logs — Nhóm 3, Đợt 3.4, Phần 4/5: sửa note.
//
// requireStaff() ở ĐẦU (như staff-account-actions): ẩn nút ở UI KHÔNG thay
// thế được check này, server action gọi được bằng POST tay. Quyền "chỉ
// actor gốc của log mới sửa được" do BACKEND quyết (403 kể cả admin khác) —
// action không biết actor của log nên không tự so, chỉ chuyển 403 thành câu
// dễ hiểu.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import { updateAuditLogNote } from "@/lib/api/audit-logs";

export interface AuditLogNoteActionResult {
  ok: boolean;
  message: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateAuditLogNoteAction(logId: string, note: string): Promise<AuditLogNoteActionResult> {
  await requireStaff();

  if (!UUID_RE.test(logId)) return { ok: false, message: "Log không hợp lệ." };
  // Plan: chặn submit nếu rỗng sau khi trim. Backend cũng chặn (422) cả log
  // tuỳ chọn lẫn log bắt buộc; chặn sớm cho khỏi 1 lượt gọi vô ích.
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) return { ok: false, message: "Vui lòng nhập ghi chú." };

  try {
    await updateAuditLogNote(logId, trimmed);
    revalidatePath("/activity-logs");
    return { ok: true, message: "Đã lưu ghi chú." };
  } catch (err) {
    if (err instanceof ApiError) {
      switch (err.status) {
        case 401:
          return { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." };
        case 403:
          return { ok: false, message: "Chỉ người đã thực hiện thao tác này mới được sửa ghi chú." };
        case 404:
          return { ok: false, message: "Không tìm thấy log này (có thể đã bị xoá)." };
        // Tài liệu API ghi lúc 409, lúc 422 cho "xoá trống note log bắt buộc"
        // — bắt cả hai, cùng 1 câu.
        case 409:
        case 422:
          return { ok: false, message: "Ghi chú không được để trống." };
        default:
          return { ok: false, message: err.message };
      }
    }
    return { ok: false, message: "Không thể lưu ghi chú, thử lại sau." };
  }
}
