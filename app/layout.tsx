import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// 22/09 — đổi từ Geist (mặc định create-next-app) sang bộ font thương
// hiệu thật của Flask (--font-body/--font-display/--font-mono,
// 00-tokens.css): Inter cho nội dung, Space Grotesk cho heading,
// JetBrains Mono cho số liệu/mono.
//
// Sửa lệch giao diện so với Flask: trước đây chỉ khai báo subset
// "latin" vì chưa xác nhận 3 font có subset "vietnamese" hay không.
// Đã kiểm tra font-data.json của next/font: cả Inter, Space Grotesk và
// JetBrains Mono đều có "vietnamese". Thiếu subset này thì mọi ký tự có
// dấu tiếng Việt (ệ, ọ, ừ, ...) rơi về font hệ thống trong khi chữ latin
// vẫn là font thương hiệu — nhìn ra ngay là chữ "lệch" so với Flask (Flask
// nạp font qua Google Fonts với đủ subset, xem base.html).
const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
});

const fontDisplay = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
});

const fontMonoBrand = JetBrains_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin", "vietnamese"],
});

// Round 5: thay metadata mặc định của create-next-app (tab trình duyệt
// đang hiện "Create Next App"). Trang nào có `metadata.title` riêng
// (vd /jobs) vẫn ghi đè giá trị này.
export const metadata: Metadata = {
  title: "MindX Career Hub",
  description:
    "Career Hub của MindX — tổng hợp job Intern & Fresher cho học viên, công cụ quản lý job/doanh nghiệp cho team Student Success.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${fontBody.variable} ${fontDisplay.variable} ${fontMonoBrand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
