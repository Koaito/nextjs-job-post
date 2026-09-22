// lib/constants.ts
// Tương đương constants.py bên Flask — dữ liệu tĩnh, không cần fetch.
// (Phần 2 mục 5 của plan: context_processor inject_role_labels -> import
// thẳng constant, không qua Provider)

// Danh sách ngành nghề cho dropdown "track" ở form đăng ký — copy y hệt
// constants.py (INDUSTRIES) để không lệch với validate phía backend.
export const INDUSTRIES = [
  "Code",
  "Data Analysis",
  "Data Engineer",
  "Data Scientist",
  "Business Analysis",
  "UI/UX Design",
] as const;

export const TRACK_OTHER = "Khác / Chưa xác định";

export const ROLE_LABELS: Record<string, string> = {
  user: "Học viên",
  ss_team: "SS Team",
  admin: "Admin",
};

// ---------------------------------------------------------------------------
// Nhóm 1 — Jobs. Copy y hệt constants.py + crawler_client/jobs.py bên
// Flask (chỉ *_MAP hardcode, KHÔNG động như level_code — xem
// lib/api/enums.ts::getLevelCodes(), gọi GET /enums thật thay vì
// hardcode vì level_code có thể đổi phía backend mà không ai nhớ sửa
// tay ở đây, level đã từng bị lệch kiểu này trước khi Flask đổi sang
// gọi GET /enums, 08/2026).

// LOCATIONS (dropdown filter job) CHỦ Ý chỉ có 4 giá trị, KHÁC hẳn
// CITIES_VN (63 tỉnh thành, dùng cho field "Thành phố" của company,
// Nhóm 2) — 2 danh sách phục vụ 2 mục đích khác nhau, backend chỉ
// filter province_name theo kiểu chứa chuỗi (ILIKE), không phải enum
// chặt, nên không cần đồng bộ 2 danh sách này với nhau.
export const JOB_LOCATIONS = ["Hà Nội", "TP.HCM", "Remote", "Hybrid"] as const;

// job_status: chỉ 2 giá trị thật ở backend (OPEN/CLOSED) — filter mặc
// định "Đang tuyển" khi không truyền status (xem lib/api/jobs.ts,
// _index_filters() bên Flask), value "ALL" là quy ước riêng của
// FE/BFF để tắt hẳn filter status, KHÔNG phải giá trị backend hiểu.
export const JOB_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang tuyển",
  CLOSED: "Đã đóng",
};
export const JOB_STATUS_LABELS_REV: Record<string, string> = Object.fromEntries(
  Object.entries(JOB_STATUS_LABELS).map(([code, label]) => [label, code]),
);

export const WORK_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  OTHER: "Khác",
};

export const SALARY_TYPE_LABELS: Record<string, string> = {
  RANGE: "Khoảng lương",
  EXACT: "Mức cố định",
  UPTO: "Lên đến",
  STARTING_FROM: "Từ",
  NEGOTIABLE: "Thỏa thuận",
  UNPAID: "Không lương",
};

// MONTH là mặc định cả ở đây lẫn backend (job cũ crawl trước 08/2026 —
// trước khi có cột salary_period — mặc định MONTH ở tầng DB). Chỉ hiện
// "/ Năm" khi period=YEAR, KHÔNG hiện "/ Tháng" cho case mặc định để đỡ
// rối (xem crawler_client/jobs.py::_fmt_salary(), README bug
// "lương '/năm' bị hiểu nhầm thành lương/tháng").
export const SALARY_PERIOD_LABELS: Record<string, string> = {
  MONTH: "Tháng",
  YEAR: "Năm",
};

/**
 * Màu badge ngành — CỐ ĐỊNH theo giá trị industry thật, KHÔNG xoay
 * vòng theo vị trí card trong lưới (bug cũ ở bản Flask trước 08/2026,
 * xem helpers.py::industry_class() — cùng ngành từng hiện 2 màu khác
 * nhau tuỳ rơi vào ô nào). Copy màu y hệt public/css/04-job-cards.css
 * (.ind-code, .ind-business-analysis...) — 4/6 màu dùng lại token
 * thương hiệu đã map ở globals.css (--brand-accent/teal/amber/blue),
 * 2 màu còn lại (Data Engineer tím, UI/UX Design hồng) KHÔNG có sẵn
 * trong 00-tokens.css nên giữ nguyên hex gốc, không tự đặt thêm biến
 * --brand-* mới chỉ vì 2 giá trị lẻ này.
 */
export const INDUSTRY_BADGE_STYLES: Record<string, { bg: string; fg: string }> = {
  Code: { bg: "var(--brand-accent-soft)", fg: "var(--brand-accent)" },
  "Business Analysis": { bg: "var(--brand-blue-soft)", fg: "var(--brand-blue)" },
  "Data Analysis": { bg: "var(--brand-teal-soft)", fg: "var(--brand-teal)" },
  "Data Engineer": { bg: "#EDE6FB", fg: "#7C3AED" },
  "Data Scientist": { bg: "var(--brand-amber-soft)", fg: "var(--brand-amber)" },
  "UI/UX Design": { bg: "#FBE3EE", fg: "#C22B7A" },
};
// Fallback cho industry lạ (dữ liệu cũ/nhập tay lệch chính tả, không
// khớp đúng 6 giá trị chuẩn) — tô xám trung tính thay vì crash hoặc
// rơi nhầm vào 1 trong 6 màu đã có (gây hiểu lầm đúng ngành đó).
export const INDUSTRY_BADGE_FALLBACK = { bg: "#EDEFEC", fg: "var(--brand-muted-text)" };

export const JOBS_PER_PAGE = 20;
