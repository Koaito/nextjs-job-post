"use server";

// lib/actions/staff-account-actions.ts
// Server action của /staff-accounts — Nhóm 3, Đợt 3.2. Phần 2/4: tạo
// tài khoản; phần 3/4: đổi role (khoá/mở = phần 4, sẽ thêm vào file này).
//
// requireAdmin() ở ĐẦU mỗi action (plan Phần 2 mục 4): Flask check role
// admin ngay trong hàm chứ không qua decorator, nên dễ bỏ sót — ẩn nút ở
// UI KHÔNG thay thế được check này (server action gọi được bằng POST tay).

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { ApiError } from "@/lib/api/client";
import { createUser, updateUserRole } from "@/lib/api/auth";
import { ROLE_LABELS } from "@/lib/constants";

export interface CreateStaffAccountInput {
  fullName: string;
  email: string;
  role: string;
}

/** Thông tin hiện ĐÚNG 1 LẦN sau khi tạo — giữ trong state client, không lưu đâu khác. */
export interface CreatedStaffAccount {
  fullName: string;
  email: string;
  role: string;
  tempPassword: string;
}

export interface CreateStaffAccountResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  account?: CreatedStaffAccount;
}

// Kiểm tra định dạng tối thiểu để báo lỗi tại chỗ; backend (Pydantic) mới
// là nơi validate chính thức.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createStaffAccountAction(
  input: CreateStaffAccountInput,
): Promise<CreateStaffAccountResult> {
  await requireAdmin();

  // Khớp Flask: full_name .strip(), email .strip().lower().
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const role = input.role;

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Vui lòng nhập họ tên.";
  else if (fullName.length > 255) fieldErrors.fullName = "Họ tên tối đa 255 ký tự.";
  if (!email) fieldErrors.email = "Vui lòng nhập email.";
  else if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "Email không hợp lệ.";
  if (!(role in ROLE_LABELS)) fieldErrors.role = "Role không hợp lệ.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Vui lòng kiểm tra lại các trường được đánh dấu.", fieldErrors };
  }

  try {
    const created = await createUser({ full_name: fullName, email, role });
    revalidatePath("/staff-accounts");
    return {
      ok: true,
      account: {
        fullName: created.full_name,
        email: created.email,
        role: created.role,
        tempPassword: created.temp_password,
      },
    };
  } catch (err) {
    // Gồm cả lỗi nghiệp vụ như email đã tồn tại — hiện đúng message backend.
    const message = err instanceof ApiError ? err.message : "Không thể tạo tài khoản, thử lại sau.";
    return { ok: false, message };
  }
}

export interface StaffAccountActionResult {
  ok: boolean;
  message: string;
}

/**
 * Đổi role 1 tài khoản (Phần 3/4). Không có ô note — backend PATCH /role
 * không nhận note; lớp ma sát là Dialog xác nhận ở UI (cải tiến so với
 * Flask, nơi đổi role tự submit ngay khi đổi dropdown, plan Nhóm 3).
 * Trả {ok, message} để <NoteConfirmDialog> hiện lỗi ngay trong dialog.
 */
export async function updateStaffRoleAction(
  ssUserId: string,
  role: string,
): Promise<StaffAccountActionResult> {
  const admin = await requireAdmin();

  if (!(role in ROLE_LABELS)) return { ok: false, message: "Role không hợp lệ." };
  // Backend cũng chặn (400), chặn sớm ở đây cho khỏi 1 lượt gọi vô ích.
  if (ssUserId === admin.ss_user_id) {
    return { ok: false, message: "Bạn không thể tự đổi role của chính mình." };
  }

  try {
    await updateUserRole(ssUserId, role);
    revalidatePath("/staff-accounts");
    return { ok: true, message: "Đã cập nhật role." };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Không thể đổi role, thử lại sau.";
    return { ok: false, message };
  }
}
