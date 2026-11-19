import { ACCOUNTS, HAS_E2E_DB, expect, login, sql, test } from "./helpers";
import type { Page } from "@playwright/test";

// /crawl, phần 3a (nền: 4 tab, widget "Đang chạy", route đọc) + 3b (tab Lịch sử) + 3c (tab Crawl) + 3d (tab Bảo trì).
// Chạy với backend + Postgres thật.
// Dữ liệu từ e2e/seed.sql: 25 lượt crawl (23 topcv hoàn tất, 1 vietnamworks lỗi, 1 careerviet ĐANG CHẠY) và
// 23 lượt bảo trì (21 backfill hoàn tất, 1 check_expired_jobs lỗi, 1 check_expired_jobs ĐANG CHẠY).
// Spec KHÔNG bấm chạy crawl/bảo trì thật (sẽ gọi TopCV/Tavily/Gemini ra ngoài).

const crawlRows = (page: Page) => page.getByRole("table", { name: "Lịch sử crawl" }).locator("tbody tr");
const maintRows = (page: Page) => page.getByRole("table", { name: "Lịch sử bảo trì" }).locator("tbody tr");

test.describe("quyền truy cập", () => {
  test("khách bị chuyển về /login", async ({ page }) => {
    await page.goto("/crawl");
    await expect(page).toHaveURL(/\/login/);
  });

  test("học viên gặp 404 ở trang; route polling trả 401 cho khách, 403 cho học viên", async ({ page }) => {
    const guest = await page.request.get("/api/crawl/active");
    expect(guest.status()).toBe(401);

    await login(page, ACCOUNTS.crawlStudent.email);
    const res = await page.goto("/crawl");
    expect(res?.status()).toBe(404);
    for (const path of ["/api/crawl/active", "/api/crawl/latest-run", "/api/maintenance/latest-runs"]) {
      const r = await page.request.get(path);
      expect(r.status(), path).toBe(403);
      expect(r.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("staff và admin đều vào được (xem trang chỉ cần staff)", async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
    await page.goto("/crawl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vận hành dữ liệu");
    await page.context().clearCookies();

    await login(page, ACCOUNTS.crawlAdmin.email);
    await page.goto("/crawl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vận hành dữ liệu");
  });
});

test.describe("khung trang và 4 tab", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("mặc định tab Crawl; 4 tab là link thật; ?tab= lạ về tab Crawl", async ({ page }) => {
    await page.goto("/crawl");
    const nav = page.getByRole("navigation", { name: "Các mục vận hành dữ liệu" });
    await expect(nav.getByRole("link")).toHaveText(["Crawl", "Tình trạng dữ liệu", "Bảo trì", "Lịch sử"]);
    await expect(nav.getByRole("link", { name: "Crawl", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/crawl?tab=khong-co");
    await expect(nav.getByRole("link", { name: "Crawl", exact: true })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Lịch sử" }).click();
    await expect(page).toHaveURL(/tab=history/);
    await expect(nav.getByRole("link", { name: "Lịch sử" })).toHaveAttribute("aria-current", "page");
  });

  test("widget Đang chạy hiện CHÉO: tab Crawl thấy bảo trì, tab Bảo trì thấy crawl, tab Tình trạng thấy cả hai", async ({ page }) => {
    const widget = page.getByTestId("active-runs");

    await page.goto("/crawl");
    await expect(widget).toContainText("Kiểm tra job hết hạn");
    await expect(widget).not.toContainText("careerviet");

    await page.goto("/crawl?tab=maintenance");
    await expect(widget).toContainText("careerviet");
    await expect(widget).not.toContainText("Kiểm tra job hết hạn");

    await page.goto("/crawl?tab=status");
    await expect(widget).toContainText("careerviet");
    await expect(widget).toContainText("Kiểm tra job hết hạn");
    await expect(widget.getByText("Đang chạy").first()).toBeVisible();
  });

  test("route đọc trả đúng dữ liệu seed cho staff", async ({ page }) => {
    const active = await page.request.get("/api/crawl/active");
    expect(active.status()).toBe(200);
    const body = await active.json();
    expect(body.crawl.map((i: { source: string }) => i.source)).toEqual(["careerviet"]);
    expect(body.maintenance.map((i: { jobType: string }) => i.jobType)).toEqual(["check_expired_jobs"]);

    const latest = await (await page.request.get("/api/crawl/latest-run")).json();
    expect(latest.run.source).toBe("careerviet");
    const bad = await page.request.get("/api/crawl/runs/khong-phai-uuid");
    expect(bad.status()).toBe(400);
  });

  test("polling chỉ chạy ở tab có widget và dừng hẳn khi sang tab Lịch sử", async ({ page }) => {
    test.setTimeout(60_000);
    let hits = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/crawl/active") hits += 1;
    });

    await page.goto("/crawl");
    await expect(page.getByTestId("active-runs")).toBeVisible();
    // Lần đầu ngay khi dựng, rồi mỗi 6 giây: sau ~7 giây phải thấy ít nhất 2 lượt.
    await expect.poll(() => hits, { timeout: 12_000 }).toBeGreaterThanOrEqual(2);

    await page
      .getByRole("navigation", { name: "Các mục vận hành dữ liệu" })
      .getByRole("link", { name: "Lịch sử", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" })).toBeVisible();
    hits = 0;
    await page.waitForTimeout(7_500);
    expect(hits).toBe(0);
  });
});

test.describe("tab Lịch sử", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("hai bảng độc lập, mỗi bảng 20 dòng ở trang 1, kèm tổng số lượt", async ({ page }) => {
    await page.goto("/crawl?tab=history");
    await expect(crawlRows(page)).toHaveCount(20);
    await expect(maintRows(page)).toHaveCount(20);
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" }).locator("..")).toContainText("25 lượt");
    await expect(page.getByRole("heading", { name: "Lịch sử bảo trì" }).locator("..")).toContainText("23 lượt");
    await expect(page.getByTestId("active-runs")).toHaveCount(0); // tab này không có widget
  });

  test("dòng lỗi hiện nội dung lỗi; dòng hoàn tất hiện số liệu và người chạy", async ({ page }) => {
    await page.goto("/crawl?tab=history&c_status=error");
    await expect(crawlRows(page)).toHaveCount(1);
    const row = crawlRows(page).first();
    await expect(row).toContainText("vietnamworks");
    await expect(row).toContainText("E2E: bị chặn bởi anti-bot");
    await expect(row).toContainText("Bị chặn");

    await page.goto("/crawl?tab=history&c_source=topcv");
    const first = crawlRows(page).first();
    await expect(first).toContainText("Tải 40 · Thêm mới 12 · Trùng 5 · Lỗi 1");
    await expect(first).toContainText("1 phút 30 giây");
    await expect(first).toContainText("E2E Crawl Admin");
  });

  test("đổi trang bảng crawl KHÔNG kéo bảng bảo trì, và ngược lại", async ({ page }) => {
    await page.goto("/crawl?tab=history");
    await page.getByRole("navigation", { name: "Phân trang lịch sử crawl" }).getByRole("link", { name: /Sau/ }).click();
    await expect(page).toHaveURL(/crawl_page=2/);
    await expect(page).not.toHaveURL(/maint_page/);
    await expect(crawlRows(page)).toHaveCount(5);
    await expect(maintRows(page)).toHaveCount(20);

    await page.getByRole("navigation", { name: "Phân trang lịch sử bảo trì" }).getByRole("link", { name: /Sau/ }).click();
    await expect(page).toHaveURL(/maint_page=2/);
    await expect(page).toHaveURL(/crawl_page=2/); // trang bảng crawl giữ nguyên
    await expect(maintRows(page)).toHaveCount(3);
    await expect(crawlRows(page)).toHaveCount(5);
  });

  test("lọc nguồn rồi lọc trạng thái; đổi lọc reset trang của đúng bảng đó, giữ bảng kia", async ({ page }) => {
    await page.goto("/crawl?tab=history&crawl_page=2&maint_page=2");
    await expect(crawlRows(page)).toHaveCount(5);

    const form = page.getByRole("form", { name: "Lọc lịch sử crawl" });
    await form.getByLabel("Nguồn").selectOption("topcv");
    await form.getByRole("button", { name: "Lọc" }).click();
    await expect(page).toHaveURL(/c_source=topcv/);
    await expect(page).not.toHaveURL(/crawl_page/); // trang bảng crawl bị reset
    await expect(page).toHaveURL(/maint_page=2/); // trang bảng bảo trì giữ nguyên
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" }).locator("..")).toContainText("23 lượt");
    await expect(crawlRows(page)).toHaveCount(20);
    await expect(maintRows(page)).toHaveCount(3);

    const maintForm = page.getByRole("form", { name: "Lọc lịch sử bảo trì" });
    await maintForm.getByLabel("Công việc").selectOption("check_expired_jobs");
    await maintForm.getByLabel("Trạng thái").selectOption("error");
    await maintForm.getByRole("button", { name: "Lọc" }).click();
    await expect(page).toHaveURL(/c_source=topcv/); // lọc bảng crawl còn nguyên
    await expect(maintRows(page)).toHaveCount(1);
    await expect(maintRows(page).first()).toContainText("E2E: kết nối cơ sở dữ liệu thất bại");
    await expect(crawlRows(page)).toHaveCount(20);

    await page.getByRole("link", { name: "Xoá lọc" }).first().click();
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" }).locator("..")).toContainText("25 lượt");
  });

  test("lọc không ra dòng nào: báo rõ, không hiện bảng rỗng", async ({ page }) => {
    await page.goto("/crawl?tab=history&c_source=topcv&c_status=running");
    await expect(page.getByText("Không có lượt crawl nào khớp bộ lọc.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Lịch sử crawl" })).toHaveCount(0);
    await expect(maintRows(page)).toHaveCount(20); // bảng kia không bị ảnh hưởng
  });

  test("trang vượt quá số trang thực có chuyển về trang cuối; tham số rác bị bỏ", async ({ page }) => {
    await page.goto("/crawl?tab=history&crawl_page=99");
    await expect(page).toHaveURL(/crawl_page=2/);
    await expect(crawlRows(page)).toHaveCount(5);

    await page.goto("/crawl?tab=history&crawl_page=abc&c_status=exploded&m_job_type=drop_tables");
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" }).locator("..")).toContainText("25 lượt");
    await expect(page.getByRole("heading", { name: "Lịch sử bảo trì" }).locator("..")).toContainText("23 lượt");
  });
});

// ---------------------------------------------------------------------------------------------------------
// Phần 3c — tab Crawl. KHÔNG chạy crawl thật: ca "chạy" duy nhất nhắm vào nguồn careerviet (seed đang có lượt chạy dở)
// nên backend trả 409 ngay ở bước tạo run, chưa có tác vụ nền nào được thêm (không gọi ra ngoài). Mỗi lần chạy spec
// gọi backend đúng 1 lần cho POST (rate limit backend 10 lượt/giờ/người).
// ---------------------------------------------------------------------------------------------------------
test.describe("tab Crawl — xem (staff)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("staff không có form chạy; thấy batch đang chạy với checklist khớp theo tên category", async ({ page }) => {
    await page.goto("/crawl");
    await expect(page.getByTestId("crawl-readonly-note")).toBeVisible();
    await expect(page.getByRole("form", { name: "Chạy crawl" })).toHaveCount(0);

    await expect(page.getByRole("heading", { name: /Batch crawl · careerviet/ })).toBeVisible();
    await expect(page.getByTestId("batch-progress")).toHaveText("0/3 category xong");
    const items = page.getByTestId("batch-checklist").locator("li");
    await expect(items).toHaveCount(3);
    // Thứ tự theo `categories` của batch; lượt chưa tới lượt chưa có record -> "Đang chờ".
    await expect(items.nth(0)).toContainText("running-cat");
    await expect(items.nth(0)).toHaveAttribute("data-state", "running");
    await expect(items.nth(1)).toContainText("data-engineer");
    await expect(items.nth(1)).toHaveAttribute("data-state", "waiting");
    await expect(items.nth(1)).toContainText("Đang chờ");
    await expect(items.nth(2)).toHaveAttribute("data-state", "waiting");

    await expect(page.getByTestId("crawl-run")).toContainText("Đã tải 12 · Thêm mới 3");
    await expect(page.getByTestId("crawl-result")).toHaveCount(0); // chưa xong thì chưa có kết quả
  });

  test("Log live hiện log của lượt đang chạy, dòng lỗi/cảnh báo có màu riêng", async ({ page }) => {
    await page.goto("/crawl");
    const log = page.getByTestId("crawl-log");
    await expect(log).toContainText("Bắt đầu crawl category running-cat");
    await expect(log).toContainText("Trang 2 phản hồi chậm");
    await expect(log.getByText(/Không tải được chi tiết tin E2E-123/)).toHaveClass(/text-red/);
    await expect(log.getByText(/Trang 2 phản hồi chậm/)).toHaveClass(/text-amber/);
  });

  test("polling batch/log chạy khi lượt còn chạy và dừng hẳn khi sang tab Lịch sử", async ({ page }) => {
    test.setTimeout(60_000);
    let hits = 0;
    page.on("request", (req) => {
      if (/^\/api\/crawl\/(batches|runs)\//.test(new URL(req.url()).pathname)) hits += 1;
    });
    await page.goto("/crawl");
    await expect(page.getByTestId("batch-checklist")).toBeVisible();
    await expect.poll(() => hits, { timeout: 15_000 }).toBeGreaterThanOrEqual(4); // batch + run + log, lặp theo chu kỳ

    await page
      .getByRole("navigation", { name: "Các mục vận hành dữ liệu" })
      .getByRole("link", { name: "Lịch sử", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" })).toBeVisible();
    hits = 0;
    await page.waitForTimeout(7_000);
    expect(hits).toBe(0);
  });
});

test.describe("tab Crawl — chạy (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlAdmin.email);
  });

  test("form hiện đủ nguồn từ backend; đổi nguồn đổi category và xoá lựa chọn cũ", async ({ page }) => {
    await page.goto("/crawl");
    const form = page.getByRole("form", { name: "Chạy crawl" });
    await expect(form).toBeVisible();
    await expect(page.getByTestId("crawl-readonly-note")).toHaveCount(0);

    const source = form.getByLabel("Nguồn");
    await expect(source.locator("option")).toHaveText(["topcv", "vietnamworks", "careerviet"]);
    await form.getByLabel("Data Analyst").check();
    await expect(form.getByLabel("Data Analyst")).toBeChecked();

    await source.selectOption("vietnamworks");
    await expect(form.getByLabel("Data Analyst")).not.toBeChecked(); // lựa chọn của nguồn cũ bị xoá

    await form.getByRole("button", { name: "Chọn tất cả" }).click();
    expect(await form.locator('input[type="checkbox"]:checked').count()).toBe(
      await form.locator('input[type="checkbox"]').count(),
    );
    await form.getByRole("button", { name: "Bỏ chọn" }).click();
    expect(await form.locator('input[type="checkbox"]:checked').count()).toBe(0);
  });

  test("kiểm tra form ngay trên trang: báo lỗi cạnh từng ô và KHÔNG gửi request", async ({ page }) => {
    let posts = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === "/api/crawl/batch") posts += 1;
    });
    await page.goto("/crawl");
    const form = page.getByRole("form", { name: "Chạy crawl" });

    await form.getByRole("button", { name: "Chạy crawl" }).click();
    await expect(form.getByText("Chọn ít nhất một category.")).toBeVisible();

    await form.getByLabel("Data Analyst").check();
    await form.getByLabel("Số trang").fill("21");
    await form.getByLabel("Số tin tối đa").fill("abc");
    await form.getByRole("button", { name: "Chạy crawl" }).click();
    await expect(form.getByText(/Số trang phải là số nguyên từ 1 đến 20/)).toBeVisible();
    await expect(form.getByText(/Số tin tối đa phải là số nguyên từ 1 đến 1000/)).toBeVisible();
    await expect(form.getByText("Chọn ít nhất một category.")).toHaveCount(0);
    expect(posts).toBe(0);
  });

  test("nguồn đang có lượt chạy dở -> 409 thật từ backend, báo rõ và giữ nguyên khối theo dõi", async ({ page }) => {
    await page.goto("/crawl");
    const form = page.getByRole("form", { name: "Chạy crawl" });
    await form.getByLabel("Nguồn").selectOption("careerviet");
    await form.getByLabel("Data Engineer").check();
    await form.getByRole("button", { name: "Chạy crawl" }).click();

    await expect(form.getByRole("alert")).toContainText("đang có lượt crawl chạy dở");
    await expect(form.getByRole("button", { name: "Chạy crawl" })).toBeEnabled(); // chỉ tắt khi đang gửi
    await expect(form.getByLabel("Data Engineer")).toBeChecked(); // lựa chọn còn nguyên để sửa/thử lại
    await expect(page.getByTestId("batch-progress")).toHaveText("0/3 category xong");
  });

  test("route POST: thiếu/sai Origin 403, body sai 400 (không đụng backend), khách 401", async ({ page, baseURL }) => {
    const url = "/api/crawl/batch";
    const good = { source: "topcv", categories: ["data-analyst"] };

    const noOrigin = await page.request.post(url, { data: good });
    expect(noOrigin.status()).toBe(403);
    const evil = await page.request.post(url, { data: good, headers: { Origin: "http://evil.example" } });
    expect(evil.status()).toBe(403);

    const headers = { Origin: baseURL! };
    expect((await page.request.post(url, { data: { ...good, categories: [] }, headers })).status()).toBe(400);
    expect((await page.request.post(url, { data: { ...good, pages: 99 }, headers })).status()).toBe(400);
    expect((await page.request.post(url, { data: { ...good, extra: 1 }, headers })).status()).toBe(400);

    await page.context().clearCookies();
    expect((await page.request.post(url, { data: good, headers })).status()).toBe(401);
  });

  test("staff ss_team và học viên bị chặn ở route chạy (xem được trang nhưng không chạy được)", async ({ page, baseURL }) => {
    const headers = { Origin: baseURL! };
    const good = { source: "topcv", categories: ["data-analyst"] };
    for (const account of [ACCOUNTS.crawlStaff, ACCOUNTS.crawlStudent]) {
      await page.context().clearCookies();
      await login(page, account.email);
      const res = await page.request.post("/api/crawl/batch", { data: good, headers });
      expect(res.status(), account.email).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// Tab Bảo trì (phần 3d). Dữ liệu seed: 5 job; backfill_company_profiles có lượt mới nhất ĐÃ XONG (5 số liệu, 2 dòng
// log), check_expired_jobs có lượt mới nhất ĐANG CHẠY (chạy thử, 3 dòng log), 3 job còn lại CHƯA TỪNG CHẠY.
// Spec KHÔNG bấm chạy job thật (sẽ gọi Tavily/Gemini/nguồn tuyển dụng ra ngoài): ca chạy duy nhất chạm backend là
// POST vào job đang chạy dở (409), backend chặn ngay ở bước tạo run, chưa có tác vụ nền nào.
// ---------------------------------------------------------------------------------------------------------

const MAINT_TAB = "/crawl?tab=maintenance";
const JOB_ORDER = [
  "backfill_company_profiles",
  "enrich_profile_from_website",
  "enrich_web_info",
  "get_fb_linkedin",
  "check_expired_jobs",
];
const JOB_LABELS = [
  "Vá hồ sơ công ty",
  "Bổ sung hồ sơ từ website",
  "Tìm thông tin công ty trên web",
  "Tìm Facebook/LinkedIn công ty",
  "Kiểm tra job hết hạn",
];
const maintCard = (page: Page, jobType: string) =>
  page.locator(`[data-testid="maintenance-card"][data-job-type="${jobType}"]`);

test.describe("tab Bảo trì — xem (staff)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("đủ 5 thẻ đúng thứ tự; staff không có form chạy; nhãn tốn phí chỉ ở enrich_web_info", async ({ page }) => {
    await page.goto(MAINT_TAB);
    await expect(page.getByRole("navigation", { name: "Các mục vận hành dữ liệu" }).getByRole("link", { name: "Bảo trì" })).toHaveAttribute("aria-current", "page");
    const cards = page.getByTestId("maintenance-card");
    await expect(cards).toHaveCount(5);
    expect(await cards.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.jobType))).toEqual(JOB_ORDER);
    await expect(cards.getByRole("heading", { level: 2 })).toHaveText(JOB_LABELS);

    await expect(page.getByTestId("maintenance-readonly-note")).toBeVisible();
    await expect(page.getByRole("form", { name: /^Chạy / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Chạy", exact: true })).toHaveCount(0);

    await expect(page.getByTestId("maintenance-costly")).toHaveCount(1);
    await expect(maintCard(page, "enrich_web_info").getByTestId("maintenance-costly")).toHaveText("Tốn phí thật");
  });

  test("job chưa từng chạy báo rõ và không có khung log; job đã chạy có trạng thái", async ({ page }) => {
    await page.goto(MAINT_TAB);
    for (const jobType of ["enrich_profile_from_website", "enrich_web_info", "get_fb_linkedin"]) {
      const card = maintCard(page, jobType);
      await expect(card.getByTestId("maintenance-never-run")).toHaveText("Job này chưa từng chạy.");
      await expect(card.getByTestId("maintenance-log")).toHaveCount(0);
      await expect(card.getByTestId("maintenance-run")).toHaveCount(0);
    }
    await expect(maintCard(page, "backfill_company_profiles").getByTestId("maintenance-run")).toBeVisible();
    await expect(maintCard(page, "check_expired_jobs").getByTestId("maintenance-run")).toBeVisible();
  });

  test("kết quả hiện đúng bộ số liệu của job: backfill xong có 5 ô; check_expired_jobs đang chạy chưa có kết quả", async ({ page }) => {
    await page.goto(MAINT_TAB);
    const done = maintCard(page, "backfill_company_profiles");
    await expect(done.locator('[data-status="done"]')).toHaveText("Hoàn tất");
    await expect(done.getByTestId("maintenance-run")).toContainText("E2E Crawl Admin");
    await expect(done.getByTestId("maintenance-run")).toContainText("Giới hạn 50");
    const result = done.getByTestId("maintenance-result");
    await expect(result.locator("dt")).toHaveText(["Đã kiểm tra", "Đã cập nhật", "Không đổi", "Thiếu domain", "Lỗi"]);
    await expect(result.locator("dd")).toHaveText(["10", "4", "5", "1", "0"]);

    const running = maintCard(page, "check_expired_jobs");
    await expect(running.locator('[data-status="running"]')).toHaveText("Đang chạy");
    await expect(running.getByTestId("maintenance-run")).toContainText("Chạy thử (không ghi)");
    await expect(running.getByTestId("maintenance-result")).toHaveCount(0);
  });

  test("Log live: mỗi thẻ hiện log của đúng lượt của nó, dòng lỗi/cảnh báo có màu riêng, không lẫn nhau", async ({ page }) => {
    await page.goto(MAINT_TAB);
    const running = maintCard(page, "check_expired_jobs").getByTestId("maintenance-log");
    await expect(running).toContainText("Bắt đầu kiểm tra job còn hạn");
    await expect(running.getByText(/Không kiểm được job E2E-456/)).toHaveClass(/text-red/);
    await expect(running.getByText(/Nguồn E2E-SRC phản hồi chậm/)).toHaveClass(/text-amber/);
    await expect(running).not.toContainText("vá hồ sơ");

    const done = maintCard(page, "backfill_company_profiles").getByTestId("maintenance-log");
    await expect(done).toContainText("Bắt đầu vá hồ sơ công ty");
    await expect(done).toContainText("Xong: kiểm tra 10, cập nhật 4");
    await expect(done).not.toContainText("kiểm tra job còn hạn");
  });

  test("log của cả tab đi qua MỘT request logs-batch; lượt đã lấy trọn log rời khỏi các lời gọi sau", async ({ page }) => {
    test.setTimeout(60_000);
    const batches: string[] = [];
    let perRun = 0;
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (u.pathname === "/api/maintenance/logs-batch") batches.push(u.searchParams.get("run_ids") ?? "");
      else if (/^\/api\/maintenance\/runs\//.test(u.pathname)) perRun += 1;
    });
    await page.goto(MAINT_TAB);
    await expect(maintCard(page, "check_expired_jobs").getByTestId("maintenance-log")).toContainText("Bắt đầu kiểm tra");
    // Lần đầu hỏi cả hai run đang hiện (job chưa từng chạy không có run để hỏi)...
    expect(batches[0].split(",")).toHaveLength(2);
    // ...rồi lượt backfill đã xong và đã trả hết log nên chỉ còn lượt đang chạy.
    await expect.poll(() => batches.at(-1)!.split(",").length, { timeout: 20_000 }).toBe(1);
    // Không có request log riêng lẻ từng run (bản Flask từng bắn 5 request mỗi 2 giây).
    expect(perRun).toBe(0);
  });

  test("polling của tab chạy khi còn job đang chạy và dừng hẳn khi sang tab Lịch sử", async ({ page }) => {
    test.setTimeout(60_000);
    let hits = 0;
    page.on("request", (req) => {
      if (/^\/api\/maintenance\/(latest-runs|logs-batch)$/.test(new URL(req.url()).pathname)) hits += 1;
    });
    await page.goto(MAINT_TAB);
    await expect(page.getByTestId("maintenance-card")).toHaveCount(5);
    await expect.poll(() => hits, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);

    await page
      .getByRole("navigation", { name: "Các mục vận hành dữ liệu" })
      .getByRole("link", { name: "Lịch sử", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Lịch sử crawl" })).toBeVisible();
    hits = 0;
    await page.waitForTimeout(7_500);
    expect(hits).toBe(0);
  });
});

test.describe("tab Bảo trì — chạy (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlAdmin.email);
  });

  test("form ở cả 5 thẻ; chỉ check_expired_jobs có hai ô tuỳ chọn; enrich_web_info đánh dấu bắt buộc giới hạn", async ({ page }) => {
    await page.goto(MAINT_TAB);
    await expect(page.getByTestId("maintenance-readonly-note")).toHaveCount(0);
    for (const label of JOB_LABELS) await expect(page.getByRole("form", { name: `Chạy ${label}` })).toBeVisible();

    const boxes = page.getByTestId("maintenance-card").getByRole("checkbox");
    await expect(boxes).toHaveCount(2);
    const expired = maintCard(page, "check_expired_jobs");
    await expect(expired.getByRole("checkbox", { name: "Chạy thử (không ghi)" })).not.toBeChecked();
    await expect(expired.getByRole("checkbox", { name: /Chỉ kiểm hạn/ })).not.toBeChecked();

    await expect(maintCard(page, "enrich_web_info").getByRole("textbox", { name: /bắt buộc/ })).toBeVisible();
    for (const jobType of JOB_ORDER.filter((t) => t !== "enrich_web_info")) {
      await expect(maintCard(page, jobType).getByRole("textbox", { name: /Giới hạn/ })).not.toHaveAccessibleName(/bắt buộc/);
    }
  });

  test("kiểm tra form ngay trên trang: báo lỗi cạnh ô và KHÔNG gửi request", async ({ page }) => {
    await page.goto(MAINT_TAB);
    let posts = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/maintenance/")) posts += 1;
    });

    const costly = maintCard(page, "enrich_web_info");
    await costly.getByRole("button", { name: "Chạy", exact: true }).click();
    await expect(costly).toContainText("bắt buộc nhập giới hạn");

    const limit = costly.getByRole("textbox", { name: /Giới hạn/ });
    for (const bad of ["0", "5001", "abc"]) {
      await limit.fill(bad);
      await costly.getByRole("button", { name: "Chạy", exact: true }).click();
      await expect(costly).toContainText("từ 1 đến 5000");
    }
    await expect(limit).toHaveAttribute("aria-invalid", "true");

    const plain = maintCard(page, "get_fb_linkedin");
    await plain.getByRole("textbox", { name: /Giới hạn/ }).fill("-1");
    await plain.getByRole("button", { name: "Chạy", exact: true }).click();
    await expect(plain).toContainText("từ 1 đến 5000");

    await page.waitForTimeout(500);
    expect(posts).toBe(0);
  });

  test("job đang chạy dở bị tắt nút (khỏi tốn hạn mức 10 lượt/giờ); các job khác bấm được", async ({ page }) => {
    await page.goto(MAINT_TAB);
    const expired = maintCard(page, "check_expired_jobs");
    await expect(expired.getByRole("button", { name: "Chạy", exact: true })).toBeDisabled();
    await expect(expired).toContainText("đang chạy, đợi xong mới chạy lại được");
    for (const jobType of JOB_ORDER.filter((t) => t !== "check_expired_jobs")) {
      await expect(maintCard(page, jobType).getByRole("button", { name: "Chạy", exact: true })).toBeEnabled();
    }
  });

  test("lỗi từ route hiện đúng thông báo trên thẻ và nút bấm lại được (429 giả lập ở trình duyệt, không thể tạo thật mà không đốt hạn mức)", async ({ page }) => {
    await page.route("**/api/maintenance/backfill_company_profiles", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, message: "x" }) }),
    );
    await page.goto(MAINT_TAB);
    const card = maintCard(page, "backfill_company_profiles");
    await card.getByRole("textbox", { name: /Giới hạn/ }).fill("5");
    await card.getByRole("button", { name: "Chạy", exact: true }).click();
    await expect(card.getByRole("alert")).toContainText("quá 10 lượt bảo trì trong 1 giờ");
    await expect(card.getByRole("button", { name: "Chạy", exact: true })).toBeEnabled();
    await expect(card.getByRole("textbox", { name: /Giới hạn/ })).toHaveValue("5"); // giữ nguyên để sửa/thử lại
  });

  test("route POST: sai Origin 403, body/job_type sai 400 (không đụng backend), khách 401", async ({ page, baseURL }) => {
    const good = {};
    const url = (jobType: string) => `/api/maintenance/${jobType}`;

    expect((await page.request.post(url("backfill_company_profiles"), { data: good })).status()).toBe(403);
    const evil = await page.request.post(url("backfill_company_profiles"), { data: good, headers: { Origin: "http://evil.example" } });
    expect(evil.status()).toBe(403);

    const headers = { Origin: baseURL! };
    const post = (jobType: string, data: unknown) => page.request.post(url(jobType), { data, headers });
    expect((await post("khong_co_job", good)).status()).toBe(400);
    // Trùng tên route đọc tĩnh: Next ưu tiên segment tĩnh, route đó không có POST nên 405 (không tới handler, không tới backend).
    expect((await post("latest-runs", good)).status()).toBe(405);
    // enrich_web_info tốn phí thật: thiếu limit bị chặn ngay ở route, không tới backend.
    const noLimit = await post("enrich_web_info", {});
    expect(noLimit.status()).toBe(400);
    expect((await noLimit.json()).message).toMatch(/bắt buộc/);
    // dry_run gửi cho job khác check_expired_jobs là 400 (kể cả false).
    expect((await post("backfill_company_profiles", { dry_run: false })).status()).toBe(400);
    expect((await post("backfill_company_profiles", { limit: 0 })).status()).toBe(400);
    expect((await post("backfill_company_profiles", { extra: 1 })).status()).toBe(400);

    await page.context().clearCookies();
    expect((await page.request.post(url("backfill_company_profiles"), { data: good, headers })).status()).toBe(401);
  });

  test("job đang chạy dở -> 409 thật từ backend, giữ status và error_code", async ({ page, baseURL }) => {
    const res = await page.request.post("/api/maintenance/check_expired_jobs", { data: {}, headers: { Origin: baseURL! } });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("maintenance_already_active");
    expect(body.message).toMatch(/chạy dở/);
  });

  test("staff ss_team và học viên bị chặn ở route chạy (xem được trang nhưng không chạy được)", async ({ page, baseURL }) => {
    const headers = { Origin: baseURL! };
    for (const account of [ACCOUNTS.crawlStaff, ACCOUNTS.crawlStudent]) {
      await page.context().clearCookies();
      await login(page, account.email);
      const res = await page.request.post("/api/maintenance/get_fb_linkedin", { data: {}, headers });
      expect(res.status(), account.email).toBe(403);
    }
  });

  // Chuyển trạng thái thật: sửa thẳng DB e2e để lượt đang chạy "xong" rồi xem thẻ tự cập nhật. Phải ĐỨNG CUỐI spec và tự
  // trả DB về như seed (try/finally), vì spec Lịch sử và widget "Đang chạy" ở trên dựa vào lượt này đang chạy.
  test("lượt đang chạy xong thì thẻ tự cập nhật: hiện kết quả, mở khoá nút, nhận nốt log cuối rồi dừng poll", async ({ page }) => {
    test.skip(!HAS_E2E_DB, "cần E2E_DATABASE_URL để chuyển trạng thái lượt chạy");
    test.setTimeout(60_000);
    const runId = sql("SELECT run_id FROM maintenance_runs WHERE job_type = 'check_expired_jobs' AND status = 'running'");
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    try {
      await page.goto(MAINT_TAB);
      const card = maintCard(page, "check_expired_jobs");
      await expect(card.getByRole("button", { name: "Chạy", exact: true })).toBeDisabled();
      await expect(card.getByTestId("maintenance-result")).toHaveCount(0);

      sql(
        `UPDATE maintenance_runs SET status = 'done', finished_at = now(),
           stats = '{"checked": 30, "expired_by_source_dead": 2, "expired_by_deadline": 3, "listings_expired_by_deadline": 4,
                     "listings_expired_by_source_dead": 5, "still_alive": 21, "needs_manual_check": 4, "cv_cleaned": 1, "cv_cleanup_errors": 0}'::jsonb
         WHERE run_id = '${runId}';
         INSERT INTO maintenance_run_logs (run_id, level, message) VALUES ('${runId}', 'INFO', '[check_expired_jobs] E2E-DONE dòng log cuối');`,
      );

      await expect(card.locator('[data-status="done"]')).toHaveText("Hoàn tất", { timeout: 15_000 });
      const result = card.getByTestId("maintenance-result");
      await expect(result.locator("dt")).toHaveCount(9);
      await expect(result.locator("dd").first()).toHaveText("30");
      await expect(card).toContainText("số job SẼ bị đóng, chưa ghi gì"); // lượt chạy thử
      await expect(card.getByRole("button", { name: "Chạy", exact: true })).toBeEnabled();
      await expect(card.getByTestId("maintenance-log")).toContainText("E2E-DONE dòng log cuối"); // dòng cuối không bị bỏ sót

      // Hết job đang chạy và mọi log đã lấy trọn: không còn request polling nào của tab này.
      await page.waitForTimeout(4_000);
      let hits = 0;
      page.on("request", (req) => {
        if (/^\/api\/maintenance\//.test(new URL(req.url()).pathname)) hits += 1;
      });
      await page.waitForTimeout(7_500);
      expect(hits).toBe(0);
    } finally {
      sql(
        `UPDATE maintenance_runs SET status = 'running', finished_at = NULL, stats = NULL WHERE run_id = '${runId}';
         DELETE FROM maintenance_run_logs WHERE message LIKE '%E2E-DONE%';`,
      );
    }
  });
});
