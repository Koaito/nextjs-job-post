// lib/email-template-placeholders.ts
// Thay 5 placeholder cố định trong nội dung mẫu email — dịch nguyên văn
// fillPlaceholders() trong public/app.js (Flask). File thuần (không
// "use client", không import gì) để dùng lại/kiểm thử độc lập.
//
// 5 placeholder do BACKEND định nghĩa (api/schemas/email_templates.py::
// PLACEHOLDER_HELP) — danh sách hiển thị cho staff lấy từ GET
// /email-templates/placeholder-help (không hard-code lại ở form), nhưng
// PHÉP THAY THẾ thì bắt buộc nằm ở frontend vì cần ngữ cảnh contact + tên
// staff đang đăng nhập. Nếu backend thêm placeholder mới thì phải thêm 1
// dòng ở đây — chú thích này để khỏi quên.

export interface PlaceholderContext {
  companyName: string;
  contactName: string;
  contactTitle: string;
  /** Tên staff đang đăng nhập (full_name) — {{TEN_STAFF}}. */
  staffName: string;
}

export function fillPlaceholders(text: string, ctx: PlaceholderContext): string {
  // Giá trị mặc định khi thiếu dữ liệu: giữ y hệt Flask để email nháp luôn
  // đọc được thay vì để lại chỗ trống/{{...}} thô.
  const contactName = ctx.contactName.trim() || "Anh/Chị phụ trách tuyển dụng";
  const contactTitle = ctx.contactTitle.trim();
  const greeting = `Kính gửi ${contactName}${contactTitle ? ` (${contactTitle})` : ""},`;
  const staffName = ctx.staffName.trim() || "[Tên bạn]";
  const companyName = ctx.companyName.trim() || "[Tên công ty]";

  // split/join thay vì replace()/replaceAll(regex): thay MỌI lần xuất hiện,
  // và giá trị thay thế chứa "$&" hay "$1" (vd tên công ty lạ) không bị
  // hiểu thành mẫu thay thế đặc biệt của String.replace.
  return text
    .split("{{LOI_CHAO}}")
    .join(greeting)
    .split("{{TEN_CONG_TY}}")
    .join(companyName)
    .split("{{TEN_NGUOI_LIEN_HE}}")
    .join(contactName)
    .split("{{CHUC_DANH}}")
    .join(contactTitle)
    .split("{{TEN_STAFF}}")
    .join(staffName);
}
