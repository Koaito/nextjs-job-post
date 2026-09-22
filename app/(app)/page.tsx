// app/(app)/page.tsx
// Khớp plan (dòng 405): "/", "/jobs" (GET) -> "/jobs" (và "/"
// redirect/alias). Giữ nguyên mọi query string (filter) khi redirect,
// vì Flask xử lý "/" và "/jobs" bằng ĐÚNG 1 view function
// (jobs.index(), @jobs_bp.route("/") + @jobs_bp.route("/jobs")) — ai
// chia sẻ link "/?q=..." vẫn phải ra đúng kết quả đã lọc.

import { redirect } from "next/navigation";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/jobs?${suffix}` : "/jobs");
}
