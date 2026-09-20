"use server";
// lib/actions/auth-actions.ts
// Server Actions cho Nhóm 0 (Auth) — thay cho blueprints/auth.py.
// Server Actions tự kiểm tra Origin header (built-in Next 14+), nên
// KHÔNG cần verifyOrigin() thủ công ở đây (khác Route Handler, xem
// Phần 2 mục 6 của plan).

import { redirect } from "next/navigation";
import { login as loginApi, getMe } from "@/lib/api/auth";
import { setAuthCookies, clearAuthCookies } from "@/lib/session";
import { ApiError } from "@/lib/api/client";
import { safeInternalPath } from "@/lib/auth-guard";

const BASE_URL = process.env.CRAWLER_API_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export type AuthActionState = {
  error?: string;
  showResend?: boolean; // true nếu lỗi là do email chưa xác thực (khớp show_resend ở Flask)
  resendEmail?: string;
  values?: Record<string, string>; // giữ lại input đã nhập khi lỗi (khớp form=request.form ở Flask)
};

/**
 * Đăng nhập. Redirect theo role sau khi thành công:
 *   - staff (ss_team/admin) + must_change_password -> /profile/security
 *   - có ?next= hợp lệ (đã qua safeInternalPath, chặn open-redirect) -> next
 *   - staff -> /dashboard, học viên -> /jobs
 * (khớp blueprints/auth.py::login() bên Flask, đã vá lỗ hổng open-redirect)
 */
export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rawNext = formData.get("next");
  const next = typeof rawNext === "string" ? safeInternalPath(rawNext) : null;

  if (!email || !password) {
    return { error: "Vui lòng nhập email và mật khẩu." };
  }

  let tokens;
  try {
    tokens = await loginApi(email, password);
  } catch (err) {
    if (err instanceof ApiError) {
      // auth_email_not_verified: backend chuẩn hoá lỗi qua error_code
      // (api/error_codes.py::AUTH_EMAIL_NOT_VERIFIED), không dò chuỗi
      // con trong message (xem Phụ lục D của plan). Đã xác nhận giá trị
      // chuỗi thật với backend_auth.py::BackendAuthError.email_not_verified.
      const showResend = err.errorCode === "auth_email_not_verified";
      return { error: err.message, showResend, resendEmail: email };
    }
    return { error: "Lỗi không xác định, vui lòng thử lại." };
  }

  await setAuthCookies(tokens.access_token, tokens.refresh_token);

  let user;
  try {
    user = await getMe(tokens.access_token);
  } catch (err) {
    await clearAuthCookies();
    return {
      error: err instanceof ApiError ? err.message : "Lỗi không xác định.",
    };
  }

  if (user.is_staff && user.must_change_password) {
    redirect("/profile/security");
  }

  if (next) {
    redirect(next);
  }
  redirect(user.is_staff ? "/dashboard" : "/jobs");
}

/**
 * Đăng ký học viên mới. Validate client-side đã có (required, minlength
 * ở <input>), nhưng validate lại ở server action để không tin thẳng
 * form (giống Flask: check full_name/email/password rỗng, password >= 8
 * ký tự, password_confirm khớp — TRƯỚC khi gọi backend).
 */
export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const track = String(formData.get("track") ?? "");

  const values = { full_name: fullName, email, phone, track };

  if (!fullName || !email || !password) {
    return { error: "Vui lòng điền đầy đủ họ tên, email và mật khẩu.", values };
  }
  if (password.length < 8) {
    return { error: "Mật khẩu cần ít nhất 8 ký tự.", values };
  }
  if (password !== passwordConfirm) {
    return { error: "Mật khẩu nhập lại không khớp.", values };
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        phone: phone || undefined,
        track: track || undefined,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body?.detail?.message ?? "Đăng ký thất bại, vui lòng thử lại.";
      return { error: message, values };
    }
  } catch {
    return { error: "Không thể kết nối tới máy chủ, vui lòng thử lại.", values };
  }

  // Thành công -> redirect sang /login kèm thông báo qua query string
  // (Server Action không giữ được flash message như Flask session, nên
  // trang /login tự đọc ?registered=1&email=... để hiện thông báo).
  redirect(`/login?registered=1&email=${encodeURIComponent(email)}`);
}

/**
 * Gửi lại email xác thực — backend CỐ Ý trả 1 message chung chung dù
 * email tồn tại hay không (chống email enumeration, xem Nhóm 0 của
 * plan). Next.js giữ nguyên hành vi này, không tách nhánh UI theo email
 * có tồn tại hay không.
 */
export async function resendVerificationAction(email: string): Promise<{ message: string }> {
  const GENERIC_MESSAGE =
    "Nếu email tồn tại và chưa xác thực, link mới đã được gửi — kiểm tra hộp thư.";

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { message: GENERIC_MESSAGE };

  try {
    await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({ email: trimmed }),
      cache: "no-store",
    });
  } catch {
    // Nuốt lỗi có chủ đích — vẫn trả message chung chung như Flask,
    // không để lộ email có tồn tại hay request có thành công hay không.
  }

  return { message: GENERIC_MESSAGE };
}

export type ForgotPasswordState = {
  message?: string; // luôn set khi submit xong, kể cả email không tồn tại (chống dò email)
  error?: string; // chỉ set khi bản thân request lỗi (mất mạng, backend sập) — KHÔNG BAO GIỜ vì "email không tồn tại"
};

/**
 * Xin link đặt lại mật khẩu — backend (`forgot_password()`,
 * api/routers/auth_registration.py) CỐ Ý luôn trả đúng 1 message chung
 * chung dù email có tồn tại hay không, và không raise lỗi vì lý do
 * "email không tồn tại" (chỉ lỗi khi chính request thất bại — mất
 * mạng, backend sập). Next.js giữ NGUYÊN hành vi 1-message-duy-nhất
 * này, không tách nhánh UI theo email tồn tại hay không (Nhóm 0 của
 * plan — chống email enumeration, cùng nguyên tắc với
 * resendVerificationAction ở trên).
 */
export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const GENERIC_MESSAGE =
    "Nếu email này có tài khoản, một email đặt lại mật khẩu đã được gửi tới đó.";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Vui lòng nhập email." };
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    // Không đọc body để rẽ nhánh theo email tồn tại hay không — backend
    // luôn trả 200 + cùng 1 message cho path này. Chỉ res.ok === false
    // (lỗi hạ tầng, rate-limit 429...) mới đáng coi là lỗi request thật.
    if (!res.ok && res.status !== 429) {
      return { error: "Không thể gửi yêu cầu lúc này, vui lòng thử lại." };
    }
    if (res.status === 429) {
      return { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
    }
  } catch {
    return { error: "Không thể kết nối tới máy chủ, vui lòng thử lại." };
  }

  return { message: GENERIC_MESSAGE };
}

export type ResetPasswordState = {
  error?: string;
  success?: boolean;
};

/**
 * Đặt mật khẩu mới bằng token từ email. Khớp `reset_password()` bên
 * backend: token dùng đúng 1 lần, sai/hết hạn phân biệt qua
 * `error_code` (AUTH_INVALID / AUTH_EXPIRED — Phụ lục D của plan,
 * không suy luận loại lỗi từ message). Thành công thì backend đã tự
 * thu hồi toàn bộ refresh token + clear active_session_id của user đó
 * — Next.js không cần tự làm gì thêm ngoài báo thành công + đưa về
 * /login (không tự đăng nhập lại, người dùng phải nhập mật khẩu mới).
 */
export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("new_password_confirm") ?? "");

  if (!token) {
    return { error: "Link đặt lại mật khẩu không hợp lệ — thiếu token." };
  }
  if (newPassword.length < 8) {
    return { error: "Mật khẩu mới cần ít nhất 8 ký tự." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Mật khẩu nhập lại không khớp." };
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({ token, new_password: newPassword }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      // error_code AUTH_EXPIRED / AUTH_INVALID (Phụ lục D) — cả 2 đều
      // hiện đúng message backend trả, không tự viết lại text khác vì
      // message đã đủ rõ và đã hướng dẫn bước tiếp theo (xin link mới).
      const message =
        detail && typeof detail === "object" && !Array.isArray(detail)
          ? detail.message
          : null;
      return { error: message ?? "Đặt lại mật khẩu thất bại, vui lòng thử lại." };
    }
  } catch {
    return { error: "Không thể kết nối tới máy chủ, vui lòng thử lại." };
  }

  return { success: true };
}
