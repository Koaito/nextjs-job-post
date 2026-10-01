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

// 34 tỉnh/thành sau sáp nhập (Nghị quyết 202/2025/QH15, hiệu lực
// 01/7/2025) — khớp TUYỆT ĐỐI với bảng `provinces` bên backend (seed ở
// sql/migration_update_provinces_2025.sql). GET /companies lọc bằng
// `p.province_name = %s` (so sánh bằng, KHÔNG phải ILIKE), nên chỉ cần
// lệch 1 ký tự (vd "TP. Hồ Chí Minh" thay vì "Hồ Chí Minh", "Thừa Thiên
// Huế" thay vì "Huế") là filter ra 0 công ty. Bản 63 tên cũ từng gây đúng
// lỗi này, đã thay bằng danh sách dưới.
// Ghi tên tỉnh CŨ (vd "Bình Dương") vào form vẫn an toàn: backend tự quy
// đổi về tỉnh mới qua province_alias.py, không cần liệt kê ở đây.
// Dùng cho field "Thành phố" của company (CompanyCombobox mục tạo mới,
// CompanyForm) và dropdown lọc /companies — KHÁC hẳn danh sách tỉnh của
// JOB (lib/api/enums.ts::getProvinceNames).
// Thứ tự: 6 thành phố trực thuộc trung ương trước, 28 tỉnh còn lại theo
// bảng chữ cái tiếng Việt.
export const CITIES_VN = [
  "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Huế",
  "An Giang", "Bắc Ninh", "Cà Mau", "Cao Bằng", "Đắk Lắk",
  "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Tĩnh",
  "Hưng Yên", "Khánh Hòa", "Lai Châu", "Lâm Đồng", "Lạng Sơn",
  "Lào Cai", "Nghệ An", "Ninh Bình", "Phú Thọ", "Quảng Ngãi",
  "Quảng Ninh", "Quảng Trị", "Sơn La", "Tây Ninh", "Thái Nguyên",
  "Thanh Hóa", "Tuyên Quang", "Vĩnh Long",
] as const;

// Giá trị đặc biệt có trong bảng `provinces` (công ty chưa rõ địa điểm).
// CHỈ dùng cho dropdown LỌC — form tạo/sửa không cho chọn, để trống
// "— Chưa rõ —" thì backend tự xếp vào "Khác".
export const CITY_OTHER = "Khác";

// Khớp ĐÚNG ROLE_LABELS trong constants.py bên Flask ("Team SS", không
// phải "SS Team" — thứ tự chữ khác nhau, dễ gõ nhầm vì đọc xuôi tai
// hơn, nhưng đây là nhãn hiển thị cho người dùng nên phải giữ nguyên
// văn để không lệch với mọi nơi khác trong hệ thống đang dùng nhãn cũ).
export const ROLE_LABELS: Record<string, string> = {
  user: "Học viên",
  ss_team: "Team SS",
  admin: "Admin",
};

// ---------------------------------------------------------------------------
// Nhóm 1 — Jobs. Copy y hệt constants.py + crawler_client/jobs.py bên
// Flask (chỉ *_MAP hardcode, KHÔNG động như level_code — xem
// lib/api/enums.ts::getLevelCodes(), gọi GET /enums thật thay vì
// hardcode vì level_code có thể đổi phía backend mà không ai nhớ sửa
// tay ở đây, level đã từng bị lệch kiểu này trước khi Flask đổi sang
// gọi GET /enums, 08/2026).

// Dropdown địa điểm của filter /jobs KHÔNG còn hardcode ở đây: GET /jobs
// lọc `province` khớp TUYỆT ĐỐI với tên trong bảng provinces (không phải
// ILIKE), nên danh sách cũ 4 giá trị ("TP.HCM", "Hybrid"...) gần như luôn
// ra 0 job. Danh sách thật lấy từ GET /enums — lib/api/enums.ts::
// getProvinceNames() (plan Phần 1 mục 3.4).

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

// ---------------------------------------------------------------------------
// Nhóm 2, Phần 1 — Companies. Copy y hệt PARTNERSHIP_POTENTIAL_MAP
// (crawler_client/companies.py) + CONTACT_STATUS_MAP (crawler_client/
// contacts.py) bên Flask.

export const COMPANIES_PER_PAGE = 20;

// HIGH/MEDIUM/LOW/UNVERIFIED — giá trị THẬT gửi lên PATCH /companies
// (partnership_potential), UNVERIFIED = mặc định "chưa đánh giá", KHÔNG
// phải "tiềm năng thấp" (xem CompanyOut.partnership_potential ở backend).
// Đặt tên biến khác PARTNERSHIP_POTENTIALS bên Flask (mảng NHÃN tiếng
// Việt) có chủ đích: theo đúng nguyên tắc "value gửi API phải là key
// backend, không phải nhãn hiển thị" (plan dòng 30/1016), <select> ở
// Next.js dùng thẳng mã HIGH/MEDIUM/LOW/UNVERIFIED làm value, tra nhãn
// hiển thị qua PARTNERSHIP_POTENTIAL_LABELS — không cần bảng
// MAP_REV như Flask (vốn phải dịch ngược nhãn -> mã vì HTML value ở đó
// là chính nhãn tiếng Việt).
export const PARTNERSHIP_POTENTIAL_CODES = ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"] as const;
export const PARTNERSHIP_POTENTIAL_LABELS: Record<string, string> = {
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
  UNVERIFIED: "Chưa đánh giá",
};

// company_size là text tự do nhưng ràng buộc định dạng — khớp y hệt
// pattern HTML của _company_form.html bên Flask (chỉ số, khoảng trắng,
// 3 kiểu dấu gạch ngang -/–/—). Dùng CHUNG ở <CompanyForm> (validate
// client-side, thấy lỗi ngay khi gõ) và company-actions.ts (validate lại
// ở server action, vì company_size không có enum cố định để chặn hoàn
// toàn phía backend — xem plan Nhóm 2).
export const COMPANY_SIZE_PATTERN = /^[\d\s\-–—]+$/;

// Nhãn tiếng Việt cho contact_status — CHỈ dùng để HIỂN THỊ (bảng contact
// read-only ở /companies/[companyId], Phần 1). Đổi trạng thái/assign
// contact thuộc Phần 2 (ContactForm, 2 cell trạng thái/assign) — chưa
// làm ở Phần 1, không cần *_MAP_REV ở đây.
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  UNCONTACTED: "Chưa liên hệ",
  EMAIL_SENT: "Đã gửi email",
  RESPONDED: "Đã phản hồi",
  IN_PARTNERSHIP: "Đang hợp tác",
};

// Mã trạng thái contact hợp lệ (khớp _VALID_CONTACT_STATUS ở
// api/routers/contacts.py) — dùng làm `value` của <select> lọc ở
// /contacts (Nhóm 2, Phần 2). Theo nguyên tắc "value gửi API là key
// backend, không phải nhãn tiếng Việt" (plan, Nhóm 3 — dropdown enum):
// KHÁC Flask (gửi nhãn tiếng Việt rồi tra CONTACT_STATUS_MAP_REV), ở đây
// gửi thẳng mã, tra nhãn hiển thị qua CONTACT_STATUS_LABELS ở trên.
export const CONTACT_STATUS_CODES = ["UNCONTACTED", "EMAIL_SENT", "RESPONDED", "IN_PARTNERSHIP"] as const;

// ---------------------------------------------------------------------------
// Nhóm 3, Đợt 3.4 — /activity-logs (Lịch sử thao tác). Khớp ACTION_TYPE_MAP
// / ENTITY_TYPE_MAP ở crawler_client/audit_logs.py bên Flask (12 action, 4
// loại đối tượng — khớp danh sách trong mô tả `action_type`/`entity_type`
// của GET /audit-logs).
//
// Theo nguyên tắc plan Nhóm 3: KEY (JOB/COMPANY/...) là thứ gửi lên API,
// NHÃN tiếng Việt chỉ để hiển thị — luôn tra qua bảng này, không suy ra
// lẫn nhau.

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_JOB: "Thêm JD",
  UPDATE_JOB: "Sửa JD",
  DELETE_JOB: "Xoá JD",
  CREATE_COMPANY: "Thêm công ty",
  UPDATE_COMPANY: "Sửa công ty",
  DELETE_COMPANY: "Xoá công ty",
  CREATE_CONTACT: "Thêm người liên hệ",
  UPDATE_CONTACT: "Sửa người liên hệ",
  DELETE_CONTACT: "Xoá người liên hệ",
  ASSIGN_CONTACT: "Gán người phụ trách",
  APPLY_JOB: "Ứng viên nộp CV",
  WITHDRAW_JOB_APPLICATION: "Ứng viên huỷ ứng tuyển",
};

/** Key đối tượng (gửi API `entity_type`) -> nhãn hiển thị. Thứ tự = thứ tự
 *  option của dropdown lọc ở phần sau của Đợt 3.4. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  JOB: "JD",
  COMPANY: "Công ty",
  CONTACT: "Người liên hệ",
  APPLICATION: "Đơn ứng tuyển",
};

export type AuditActionTone = "success" | "warning" | "danger" | "neutral";

/**
 * Màu badge hành động theo `action_type` (KHÔNG dò chữ trong nhãn tiếng
 * Việt như Flask — bên đó "Gán người phụ trách"/"Ứng viên nộp CV"/"Ứng
 * viên huỷ" đều rơi vào nhánh `else` và bị tô đỏ như xoá):
 *   CREATE_* / APPLY_*              -> xanh
 *   UPDATE_* / ASSIGN_*             -> vàng
 *   DELETE_* / WITHDRAW_*           -> đỏ
 *   action lạ (backend thêm mới)    -> xám, không đoán bừa
 */
export function auditActionTone(actionType: string): AuditActionTone {
  if (actionType.startsWith("CREATE_") || actionType.startsWith("APPLY_")) return "success";
  if (actionType.startsWith("UPDATE_") || actionType.startsWith("ASSIGN_")) return "warning";
  if (actionType.startsWith("DELETE_") || actionType.startsWith("WITHDRAW_")) return "danger";
  return "neutral";
}

export const AUDIT_ACTION_TONE_CLASSES: Record<AuditActionTone, string> = {
  success: "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]",
  warning: "bg-[var(--brand-amber-soft)] text-[var(--brand-amber)]",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-[#EDEFEC] text-muted-foreground",
};
