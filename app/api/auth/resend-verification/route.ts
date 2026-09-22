// app/api/auth/resend-verification/route.ts
// BFF gửi lại email xác thực — dùng chung cho nhánh show_resend ở
// /login và nhánh "expired" ở /verify-email (ResendVerificationForm).
// Chuyển từ Server Action (lib/actions/auth-actions.ts) sang Route
// Handler theo plan (Phần 2 mục 1). Backend CỐ Ý trả 1 message chung
// chung dù email tồn tại hay không (chống email enumeration, Nhóm 0)
// — giữ NGUYÊN hành vi này, không tách nhánh theo email có tồn tại.

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin } from "@/lib/verify-origin";

const BASE_URL = process.env.CRAWLER_API_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

const GENERIC_MESSAGE =
  "Nếu email tồn tại và chưa xác thực, link mới đã được gửi — kiểm tra hộp thư.";

export async function POST(req: NextRequest) {
  const originCheck = verifyOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  try {
    await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch {
    // Nuốt lỗi có chủ đích — vẫn trả message chung chung như Flask,
    // không để lộ email có tồn tại hay request có thành công hay không.
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
