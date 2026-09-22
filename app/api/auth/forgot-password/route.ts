// app/api/auth/forgot-password/route.ts
// BFF xin link đặt lại mật khẩu. Chuyển từ Server Action sang Route
// Handler theo plan (Phần 2 mục 1). Backend
// (forgot_password(), api/routers/auth_registration.py) CỐ Ý luôn trả
// đúng 1 message chung chung dù email tồn tại hay không, chỉ raise lỗi
// khi CHÍNH request thất bại (mất mạng/backend sập/rate-limit) — giữ
// NGUYÊN hành vi 1-message-duy-nhất này (chống email enumeration, cùng
// nguyên tắc với resend-verification).

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin } from "@/lib/verify-origin";

const BASE_URL = process.env.CRAWLER_API_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

const GENERIC_MESSAGE =
  "Nếu email này có tài khoản, một email đặt lại mật khẩu đã được gửi tới đó.";

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
    return NextResponse.json(
      { ok: false, message: "Vui lòng nhập email." },
      { status: 400 },
    );
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
    // (lỗi hạ tầng) hoặc 429 (rate-limit) mới coi là lỗi request thật.
    if (res.status === 429) {
      return NextResponse.json(
        { ok: false, message: "Bạn thao tác quá nhanh, vui lòng thử lại sau." },
        { status: 429 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: "Không thể gửi yêu cầu lúc này, vui lòng thử lại." },
        { status: res.status },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Không thể kết nối tới máy chủ, vui lòng thử lại." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
