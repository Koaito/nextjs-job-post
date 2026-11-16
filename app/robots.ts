import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Chỉ /jobs (công khai, thiết kế cho SEO) được lập chỉ mục; API và trang thao tác thì không.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/jobs"],
      disallow: ["/api/", "/jobs/add", "/jobs/*/edit"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
