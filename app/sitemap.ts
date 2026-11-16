import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Mới liệt kê trang tĩnh. Từng /jobs/[id] chưa đưa vào: cần endpoint liệt kê id job công khai
// (backend chưa có) và mỗi lần dựng sitemap sẽ gọi Render đang ngủ — để sau khi cutover.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/jobs`, changeFrequency: "daily", priority: 1 }];
}
