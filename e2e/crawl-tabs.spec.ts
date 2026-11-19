import type { Page } from "@playwright/test";
import { ACCOUNTS, clientIpHeaders, expect, login, test } from "./helpers";

// /crawl, phần 3f (chốt Nhóm 6): hành vi CHÉO TAB. Mỗi tab chỉ gọi đúng các endpoint của nó, không có request thừa từ
// tab khác hay khi tab trình duyệt bị ẩn; và phiên chết (đăng nhập nơi khác) thì mọi tab của /crawl đưa về /login,
// không hiện trang lỗi, không vòng lặp. Backend + Postgres thật. Seed có sẵn một lượt crawl careerviet và một lượt
// bảo trì check_expired_jobs ĐANG CHẠY, nên tab Crawl và tab Bảo trì có lý do để poll.

const TABS = ["crawl", "status", "maintenance", "history"] as const;
const tabUrl = (tab: (typeof TABS)[number]) => (tab === "crawl" ? "/crawl" : `/crawl?tab=${tab}`);

/** Ghi lại request `/api/*` của trang (không tính điều hướng, RSC, tài nguyên tĩnh, và polling của layout toàn app). */
function recordApi(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    // /api/messages/* là huy hiệu tin nhắn chưa đọc của layout toàn app, không thuộc tab nào của /crawl.
    if (u.pathname.startsWith("/api/") && !u.pathname.startsWith("/api/messages/")) seen.push(u.pathname);
  });
  return seen;
}

const isMaintenanceApi = (p: string) => p.startsWith("/api/maintenance/");
const isCrawlRunApi = (p: string) => /^\/api\/crawl\/(runs|batches|latest-run|batch)(\/|$)/.test(p);

test.describe("mỗi tab chỉ gọi endpoint của nó", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("tab Lịch sử không poll, không có request /api nào", async ({ page }) => {
    const seen = recordApi(page);
    await page.goto(tabUrl("history"));
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" })).toBeVisible();
    await page.waitForTimeout(8_000);
    expect(seen).toEqual([]);
  });

  test("tab Tình trạng dữ liệu chỉ poll widget Đang chạy, không chạm API run/bảo trì", async ({ page }) => {
    const seen = recordApi(page);
    await page.goto(tabUrl("status"));
    await expect(page.getByTestId("status-tab")).toBeVisible();
    await page.waitForTimeout(8_000);
    expect(seen.filter((p) => p !== "/api/crawl/active")).toEqual([]);
    expect(seen.filter(isMaintenanceApi)).toEqual([]);
    expect(seen.filter(isCrawlRunApi)).toEqual([]);
  });

  test("tab Crawl poll lượt crawl của nó, KHÔNG poll API bảo trì", async ({ page }) => {
    const seen = recordApi(page);
    await page.goto(tabUrl("crawl"));
    await expect(
      page.getByRole("navigation", { name: "Các mục vận hành dữ liệu" }).getByRole("link", { name: "Crawl", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(8_000);
    expect(seen.filter(isCrawlRunApi).length).toBeGreaterThan(0);
    expect(seen.filter(isMaintenanceApi)).toEqual([]);
  });

  test("tab Bảo trì poll latest-runs và logs-batch, KHÔNG poll API lượt crawl", async ({ page }) => {
    const seen = recordApi(page);
    await page.goto(tabUrl("maintenance"));
    await expect(page.getByTestId("maintenance-card")).toHaveCount(5);
    await page.waitForTimeout(8_000);
    expect(seen).toContain("/api/maintenance/latest-runs");
    expect(seen).toContain("/api/maintenance/logs-batch");
    expect(seen.filter(isCrawlRunApi)).toEqual([]);
    // Cả tab chỉ dùng hai endpoint gộp, không có request log hay run riêng lẻ.
    expect(seen.filter((p) => /^\/api\/maintenance\/runs\//.test(p))).toEqual([]);
  });

  test("đổi tab: request của tab cũ dừng hẳn (không rò sang tab mới)", async ({ page }) => {
    const seen = recordApi(page);
    await page.goto(tabUrl("maintenance"));
    await expect(page.getByTestId("maintenance-card")).toHaveCount(5);
    await expect.poll(() => seen.filter(isMaintenanceApi).length, { timeout: 10_000 }).toBeGreaterThan(0);

    await page.getByRole("navigation", { name: "Các mục vận hành dữ liệu" }).getByRole("link", { name: "Lịch sử", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" })).toBeVisible();
    const before = seen.length;
    await page.waitForTimeout(7_500);
    expect(seen.length).toBe(before);
  });
});

test.describe("tab trình duyệt bị ẩn", () => {
  test("không poll khi ẩn; quay lại thì cập nhật ngay", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, ACCOUNTS.crawlStaff.email);
    // Giả lập tab ẩn TRƯỚC khi trang dựng (SWR đọc document.visibilityState).
    await page.addInitScript(() => {
      const w = window as unknown as { __hidden: boolean };
      w.__hidden = true;
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (w.__hidden ? "hidden" : "visible") });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => w.__hidden });
    });
    const seen = recordApi(page);
    await page.goto(tabUrl("maintenance"));
    await expect(page.getByTestId("maintenance-card")).toHaveCount(5);

    // Cho các lần tải đầu (mount) xong, rồi đo: ẩn thì không được thêm request nào dù có job đang chạy.
    await page.waitForTimeout(4_000);
    const settled = seen.length;
    await page.waitForTimeout(8_000);
    expect(seen.length).toBe(settled);

    // Quay lại tab: revalidate-on-focus gọi ngay, không đợi chu kỳ.
    await page.evaluate(() => {
      (window as unknown as { __hidden: boolean }).__hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => seen.length, { timeout: 6_000 }).toBeGreaterThan(settled);
  });
});

test.describe("phiên chết thì mọi tab của /crawl đưa về /login", () => {
  for (const tab of TABS) {
    test(`tab ${tab}: đăng nhập ở nơi khác thì về /login kèm thông báo, không trang lỗi, không vòng lặp`, async ({ browser }) => {
      const a = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
      const b = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
      try {
        const pageA = await a.newPage();
        await login(pageA, ACCOUNTS.crawlStaff.email);
        await pageA.goto(tabUrl(tab));
        await expect(pageA).toHaveURL(new RegExp(tab === "crawl" ? "/crawl$" : `tab=${tab}`));

        // Đăng nhập cùng tài khoản ở nơi khác: backend chỉ giữ một phiên, phiên của A chết.
        const pageB = await b.newPage();
        await login(pageB, ACCOUNTS.crawlStaff.email);
        await expect(pageB).not.toHaveURL(/\/login/);

        // Tải lại đúng tab đó: về /login (replaced), chứ không phải trang lỗi hay trang nửa sống.
        await pageA.goto(tabUrl(tab));
        await expect(pageA).toHaveURL(/\/login\?.*reason=replaced/);
        await expect(pageA.locator("p[role=alert]")).toBeVisible();
        await expect(pageA.getByText("Mã lỗi")).toHaveCount(0);
        // Không vòng lặp: đứng yên ở /login.
        await pageA.waitForTimeout(1_500);
        await expect(pageA).toHaveURL(/\/login\?.*reason=replaced/);
      } finally {
        await a.close();
        await b.close();
      }
    });
  }
});
