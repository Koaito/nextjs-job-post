import type { NextConfig } from "next";

// Header bảo mật (Mục 8 roadmap, checklist go-live KE_HOACH_NEXTJS.md).
// CSP chưa bật: cần đo trước (font Google, Sonner, script inline của Next) rồi mới siết.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Vercel luôn phục vụ HTTPS; trình duyệt bỏ qua header này trên http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
