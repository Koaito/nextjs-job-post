// app/(public)/verify-email/page.tsx
//
// QUAN TRỌNG (Nhóm 0 của plan): route này KHÔNG tự xử lý token xác
// thực. Link trong email trỏ THẲNG tới backend (GET /auth/verify-email
// bên Scrap_JD) — backend tự verify token xong rồi mới redirect (302)
// về ĐÚNG route này kèm ?status=success|expired|invalid. Trang này chỉ
// đọc `status` từ query string và hiển thị đúng 3 nhánh tương ứng,
// KHÔNG được tự gọi thêm API nào để "verify token" tại đây — nếu tự
// gọi API verify ở trang này sẽ verify sai luồng (có thể verify 2 lần
// hoặc verify nhầm thời điểm).
import { ResendVerificationForm } from "@/components/resend-verification-form";

type Status = "success" | "expired" | "invalid";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  // Backend chỉ gửi đúng 3 giá trị, nhưng phòng trường hợp truy cập
  // trực tiếp không qua link email (thiếu/khác lạ status) -> coi như
  // "invalid", không đoán mò hay hiện nhánh "success" nhầm.
  const status: Status =
    rawStatus === "success" || rawStatus === "expired" ? rawStatus : "invalid";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
              ✓
            </div>
            <h1 className="mb-2 text-2xl font-semibold">Xác thực thành công</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Tài khoản của bạn đã được kích hoạt — bây giờ có thể đăng nhập
              để lưu job yêu thích và ứng tuyển.
            </p>
            <a
              href="/login"
              className="block w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
            >
              Đăng nhập ngay
            </a>
          </>
        )}

        {status === "expired" && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-700">
              !
            </div>
            <h1 className="mb-2 text-2xl font-semibold">Liên kết đã hết hạn</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Link xác thực chỉ có hiệu lực trong 24 giờ. Nhập email đã đăng
              ký để nhận link mới.
            </p>
            <div className="text-left">
              <ResendVerificationForm />
            </div>
          </>
        )}

        {status === "invalid" && (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">
              ✕
            </div>
            <h1 className="mb-2 text-2xl font-semibold">Liên kết không hợp lệ</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Liên kết đã được dùng trước đó hoặc không đúng. Thử đăng ký lại
              hoặc xin gửi lại email xác thực từ trang đăng nhập.
            </p>
            <a
              href="/register"
              className="block w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              Đăng ký lại
            </a>
          </>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Đã xác thực rồi?{" "}
          <a href="/login" className="underline">
            Quay lại đăng nhập
          </a>
        </p>
      </div>
    </div>
  );
}
