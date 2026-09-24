import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// 22/09 — đổi từ Geist (mặc định create-next-app) sang bộ font thương
// hiệu thật của Flask (--font-body/--font-display/--font-mono,
// 00-tokens.css): Inter cho nội dung, Space Grotesk cho heading,
// JetBrains Mono cho số liệu/mono. Chỉ dùng subset "latin" (không thêm
// "vietnamese") để chắc chắn build được — chưa xác nhận cả 3 font này
// có subset vietnamese trên next/font/google hay không, nên không tự
// bịa thêm subset chưa kiểm chứng chỉ để "đẹp hơn".
const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const fontDisplay = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const fontMonoBrand = JetBrains_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin"],
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
