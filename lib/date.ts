// lib/date.ts
// Tương đương now_vn()/_parse_any_date() (helpers.py, Flask) — Phụ lục F
// của plan. Vercel Serverless Function chạy giờ hệ thống UTC; lỗi lệch 7
// tiếng từng xảy ra THẬT ở bản Flask (đặc biệt khung 00:00–07:00 giờ VN,
// lúc đó UTC còn là ngày hôm trước -> mọi phép tính theo "hôm nay"/"tháng
// này" lùi sai 1 ngày). Nên MỌI chỗ cần "hôm nay"/ranh giới tháng ở phía
// Next.js phải đi qua các hàm dưới đây, KHÔNG gọi `new Date()` trần rồi tự
// so sánh.
//
// Toàn bộ ngày ở đây được biểu diễn bằng chuỗi "YYYY-MM-DD" (giờ VN):
// so sánh trực tiếp bằng toán tử < / >= là đúng (cùng độ dài, cùng thứ tự
// từ điển với thứ tự thời gian) và cắt theo tháng bằng .slice(0, 7).

const VN_TZ = "Asia/Ho_Chi_Minh";

// "en-CA" cho sẵn định dạng YYYY-MM-DD.
const VN_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ });

/** "Hôm nay" dạng YYYY-MM-DD theo giờ Việt Nam (UTC+7). */
export function todayVN(): string {
  return VN_DATE_FORMAT.format(new Date());
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Có hậu tố múi giờ ("Z" hoặc ±hh[:mm]) ở cuối chuỗi ISO datetime.
const HAS_TZ_RE = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

/**
 * Chuỗi ngày/giờ từ backend -> "YYYY-MM-DD" theo giờ VN, hoặc null nếu
 * rỗng/không parse được. Khớp _parse_any_date() bên Flask, khác đúng 1
 * điểm CÓ CHỦ Ý: Flask lấy `.date()` của timestamp UTC ("...Z") mà KHÔNG
 * quy đổi sang giờ VN, nên job tạo lúc 06:00 sáng VN (23:00 UTC hôm
 * trước) bị tính vào ngày/tháng trước — đúng bản chất lỗi Phụ lục F. Ở
 * đây timestamp có múi giờ luôn được quy đổi sang VN trước khi lấy ngày.
 *   - "2026-09-29"                -> giữ nguyên (không có giờ để lệch)
 *   - "2026-09-28T18:00:00Z"      -> "2026-09-29" (VN)
 *   - "2026-09-29T10:00:00" (naive) -> "2026-09-29" (coi đã đúng giờ hiển
 *     thị, không tự cộng/trừ giờ — cùng quy ước format_date() của Flask)
 */
export function toVNDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const text = value.trim();
  if (DATE_ONLY_RE.test(text)) return text;

  if (!HAS_TZ_RE.test(text)) {
    const head = text.slice(0, 10);
    return DATE_ONLY_RE.test(head) ? head : null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return VN_DATE_FORMAT.format(parsed);
}

/**
 * Chuỗi ngày/giờ từ backend -> "dd/mm/yyyy" theo giờ VN, hoặc "—" nếu
 * rỗng/không parse được. Tương đương filter format_date() bên Flask (mặc
 * định "%d/%m/%Y") và dùng cùng quy tắc quy đổi múi giờ của toVNDate(),
 * nên không phụ thuộc múi giờ máy chạy (Vercel = UTC) hay locale trình
 * duyệt như `new Date(...).toLocaleDateString()`.
 */
export function formatDateVN(value: string | null | undefined): string {
  const iso = toVNDate(value);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
