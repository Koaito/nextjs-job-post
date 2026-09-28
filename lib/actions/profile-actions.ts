"use server";

// lib/actions/profile-actions.ts
// Server action của trang /profile (Thông tin chung) — plan Nhóm 5:
// "server action đổi hồ sơ". Tương đương profile.index() (POST) bên Flask.
//
// Luật (khớp Flask + PATCH /auth/me):
//   - full_name bắt buộc (tự .trim() rồi chặn rỗng trước khi gọi API).
//   - phone/track CHỈ của học viên. Staff không có 2 ô này trên form và
//     action tự bỏ qua dù client gửi gì (Flask: `if current_user.is_student
//     else ""`; backend cũng ép NULL cho staff).
//   - PATCH /auth/me luôn ghi đè đủ 3 field: gửi "" hoặc bỏ field = xoá
//     giá trị cũ (backend chuẩn hoá thành NULL).
//
// Plan Nhóm 5: sau khi cập nhật hồ sơ, header/sidebar phải hiện tên mới
// NGAY, không đợi F5 -> revalidatePath("/", "layout") để layout (sidebar
// đọc getCurrentUser()) render lại với dữ liệu mới.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { updateMe } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/session";

export interface ProfileInput {
  fullName: string;
  phone: string;
  track: string;
}

export interface ProfileActionResult {
  ok: boolean;
  message?: string;
  /** Lỗi theo từng field — form tô đỏ tại chỗ, GIỮ NGUYÊN input đã nhập. */
  fieldErrors?: Record<string, string>;
}

export async function updateProfileAction(input: ProfileInput): Promise<ProfileActionResult> {
  // Mọi role đều được sửa hồ sơ của CHÍNH MÌNH (Flask: @login_required).
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn — vui lòng tải lại trang và đăng nhập lại." };
  }

  const fullName = input.fullName.trim();
  const isStudent = !user.is_staff;
  const phone = isStudent ? input.phone.trim() : "";
  const track = isStudent ? input.track.trim() : "";

  // Chặn sớm theo đúng giới hạn UserProfileUpdate ở backend (255/30/100)
  // để báo lỗi tại chỗ thay vì 422 khó hiểu.
  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Vui lòng nhập họ và tên.";
  else if (fullName.length > 255) fieldErrors.fullName = "Họ và tên tối đa 255 ký tự.";
  if (phone.length > 30) fieldErrors.phone = "Số điện thoại tối đa 30 ký tự.";
  if (track.length > 100) fieldErrors.track = "Định hướng ngành tối đa 100 ký tự.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Vui lòng kiểm tra lại các trường được đánh dấu.", fieldErrors };
  }

  try {
    await updateMe({
      full_name: fullName,
      phone: phone || undefined,
      track: track || undefined,
    });
  } catch (err) {
    // Gồm cả 429 (rate limit 10 lần/giờ theo user) — hiện đúng message
    // backend trả.
    const message = err instanceof ApiError ? err.message : "Không thể cập nhật thông tin, thử lại sau.";
    return { ok: false, message };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Đã cập nhật thông tin cá nhân." };
}
