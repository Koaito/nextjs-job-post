// components/save-btn-style.ts
// Style của nút "🔖 Lưu job" / "🔖 Đã lưu" / "🔖 Đăng nhập để lưu" trên card
// job — bám `.save-btn` và `.save-btn.saved` (02-auth.css, Flask).
//
// Tách ra file thuần (KHÔNG có "use client") vì 2 nơi dùng chung:
//   - <SaveJobButton variant="card"> (Client Component)
//   - link "Đăng nhập để lưu" trong <JobCard> (Server Component)
// Server Component không dùng được hằng số export từ file "use client"
// (nhận về client reference chứ không phải giá trị chuỗi).

export const SAVE_BTN_CLASS =
  "inline-flex cursor-pointer items-center rounded-lg border border-border bg-card px-2.5 py-1.5 " +
  "text-xs text-[var(--brand-ink-soft)] disabled:cursor-default disabled:opacity-60";

/** `.save-btn.saved` — nền cam nhạt, viền cam, chữ đậm. */
export const SAVE_BTN_SAVED_CLASS =
  "border-primary bg-accent font-semibold text-[#C4401F]";
