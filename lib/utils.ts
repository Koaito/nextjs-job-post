export { cn } from "cn"

/**
 * Thêm giá trị hiện tại vào cuối danh sách option nếu nó không nằm trong
 * đó — dùng cho <select> tỉnh/level: job cũ có thể mang giá trị legacy
 * (vd tỉnh "Bình Dương" trước sáp nhập) không còn trong danh sách hợp lệ
 * từ GET /enums; thiếu option này <select> sẽ hiện "— chọn —" như thể job
 * chưa có địa điểm (đúng lỗi từng gặp ở form Flask).
 */
export function withCurrentOption(options: string[], current?: string | null): string[] {
  const value = current?.trim();
  if (!value || options.includes(value)) return options;
  return [...options, value];
}
