// app/api/applications/route.ts
// Route Handler nộp CV ứng tuyển (POST /me/applications, multipart) — Nhóm 5,
// Đợt 5.3 của plan. Tương đương blueprints/my_stuff.py::job_apply() (Flask).
//
// VÌ SAO Route Handler chứ không phải Server Action: nộp CV là upload file
// tới 5MB. Server Action mặc định chỉ nhận body 1MB (phải nới
// serverActions.bodySizeLimit), còn plan (Phụ lục B + Nhóm 5) đã chốt test
// đường upload qua Route Handler. LƯU Ý: Vercel giới hạn body ~4.5MB cho
// function, nên CV sát mốc 5MB có thể bị chặn (413) TRƯỚC khi vào handler
// này — phải test trên Vercel preview thật (việc của Đợt 5.4), client đã
// có xử lý riêng cho trường hợp này (xem components/apply-job-dialog.tsx).
//
// Route mutation dựa cookie -> BẮT BUỘC verifyOrigin() (Phần 2 mục 6).
// Hết phiên -> 401 JSON thật, không redirect (middleware loại /api/*).
//
// Ứng tuyển trùng (409) KHÔNG phải lỗi: trả ok:true + alreadyApplied để UI
// hiện toast thành công "Bạn đã ứng tuyển job này rồi." (plan Nhóm 5).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { applyToJob } from "@/lib/api/me";
import { getCurrentUser } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_CV_BYTES = 5 * 1024 * 1024; // khớp backend: tối đa 5MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!verifyOrigin(req).ok) return fail("Yêu cầu không hợp lệ.", 403);

  const user = await getCurrentUser();
  if (!user) return fail("Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.", 401);
  // Khớp Flask: tài khoản team SS không dùng để ứng tuyển.
  if (user.is_staff) return fail("Tài khoản team SS không dùng để ứng tuyển.", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Không đọc được dữ liệu gửi lên. Vui lòng thử lại.", 400);
  }

  const jobId = String(form.get("job_id") ?? "").trim();
  if (!UUID_RE.test(jobId)) return fail("Mã job không hợp lệ.", 400);

  const note = String(form.get("note") ?? "").trim();

  // Kiểm tra file giống thứ tự Flask: có file -> đuôi .pdf -> dung lượng.
  const cv = form.get("cv_file");
  if (!(cv instanceof File) || cv.name === "" || cv.size === 0) {
    return fail("Vui lòng đính kèm file CV (.pdf) khi ứng tuyển.", 400);
  }
  if (!cv.name.toLowerCase().endsWith(".pdf")) {
    return fail("Chỉ chấp nhận file CV định dạng PDF (.pdf).", 400);
  }
  if (cv.size > MAX_CV_BYTES) return fail("File CV không được vượt quá 5MB.", 400);

  try {
    const application = await applyToJob({ jobId, note: note || undefined, cvFile: cv });
    revalidatePath("/profile/applications");
    return NextResponse.json(
      {
        ok: true,
        alreadyApplied: false,
        message: `Đã ghi nhận ứng tuyển "${application.job_title}" tại ${application.company_name}. Team SS sẽ liên hệ bạn sớm.`,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      // 409 = đã ứng tuyển rồi -> hiện như thành công (plan Nhóm 5).
      if (err.status === 409) {
        return NextResponse.json(
          { ok: true, alreadyApplied: true, message: "Bạn đã ứng tuyển job này rồi." },
          { headers: NO_STORE },
        );
      }
      if (err.status === 429) {
        return fail("Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.", 429);
      }
      // Các lỗi nghiệp vụ khác (job đã đóng, CV sai định dạng...) — hiện
      // đúng message backend trả.
      return fail(err.message, err.status && err.status >= 400 && err.status < 500 ? err.status : 502);
    }
    return fail("Không thể nộp hồ sơ lúc này, vui lòng thử lại sau.", 502);
  }
}
