// lib/site-url.ts — origin công khai của app (dùng cho robots/sitemap). Đọc từ
// NEXT_PUBLIC_APP_URL (cùng biến lib/verify-origin.ts dùng), bỏ dấu "/" cuối.
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
