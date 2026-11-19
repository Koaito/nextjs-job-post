import { ACCOUNTS, HAS_E2E_DB, expect, login, sql, test } from "./helpers";
import type { Page } from "@playwright/test";

// /crawl?tab=status (Nhóm 6, phần 3e): số liệu thiếu field của Job và Company, nhóm job nghi trùng (có gợi ý nên giữ
// do backend tính) và job đã hết hạn nhưng vẫn Đang tuyển, MỖI bảng có nút "Đóng job này" (đóng thật qua PATCH
// /jobs/{id}, ghi chú cố định do server điền). Backend + Postgres thật, không mock.
//
// Dữ liệu seed gốc KHÔNG có nhóm trùng hay job hết hạn, nên ca đầu kiểm trạng thái rỗng; các ca còn lại tự chèn job
// bằng SQL (tiền tố E2E-HEALTH-) và DỌN LẠI ở afterAll, vì spec jobs-public đếm đúng 23 job.
//   - 13 nhóm trùng: TOP (3 job, hạn +90/+60/+30 ngày -> gợi ý giữ job +90), TIE (3 job cùng hạn -> không gợi ý),
//     11 nhóm 2 job. Backend xếp nhóm theo số job giảm dần nên TOP và TIE luôn ở trang 1; 13 nhóm -> 2 trang (10 + 3).
//   - 21 job hết hạn E2E-HEALTH-EXP-01..21, hạn nộp lùi dần từ hôm qua (backend xếp mới hết hạn trước) -> 2 trang (20 + 1).
// Người đóng job là tài khoản ss_team (staff thường): chứng tỏ không cần admin.

const STATUS_TAB = "/crawl?tab=status";
const DUP_NOTE = "Đóng do nghi trùng lặp (tab Vận hành dữ liệu — Tình trạng dữ liệu)";
const EXP_NOTE = "Đóng do đã quá hạn nhưng vẫn Đang tuyển (tab Vận hành dữ liệu — Tình trạng dữ liệu)";

const groups = (page: Page) => page.getByTestId("duplicate-group");
const expiredRows = (page: Page) =>
  page.getByRole("table", { name: "Job đã hết hạn nhưng vẫn Đang tuyển" }).locator("tbody tr");
const groupOf = (page: Page, position: string) => groups(page).filter({ hasText: position });
const closeButton = (page: Page, jobTitle: string) => page.getByRole("button", { name: `Đóng job ${jobTitle}` });
const confirmClose = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Đóng job", exact: true });

function seedHealthJobs() {
  sql(`
    CREATE TEMP TABLE tpl AS SELECT * FROM job_postings WHERE job_status = 'OPEN' ORDER BY created_at LIMIT 1;
    INSERT INTO job_postings
    SELECT (jsonb_populate_record(null::job_postings, to_jsonb(tpl) || jsonb_build_object(
             'job_id', gen_random_uuid(), 'job_title', v.title, 'dedup_key', md5(v.title || v.k),
             'deadline', v.dl, 'job_status', 'OPEN'))).*
    FROM tpl, (
      SELECT 'E2E-HEALTH-TOP' AS title, k, current_date + d AS dl FROM (VALUES ('a', 90), ('b', 60), ('c', 30)) x(k, d)
      UNION ALL
      SELECT 'E2E-HEALTH-TIE', k, current_date + 45 FROM (VALUES ('a'), ('b'), ('c')) x(k)
      UNION ALL
      SELECT 'E2E-HEALTH-DUP-' || lpad(n::text, 2, '0'), k, current_date + d
      FROM generate_series(1, 11) n, (VALUES ('a', 60), ('b', 30)) x(k, d)
      UNION ALL
      SELECT 'E2E-HEALTH-EXP-' || lpad(n::text, 2, '0'), 'x', current_date - n FROM generate_series(1, 21) n
    ) AS v(title, k, dl);
  `);
}

function cleanupHealthJobs() {
  sql(`
    DELETE FROM audit_logs WHERE entity_label LIKE 'E2E-HEALTH-%';
    DELETE FROM job_postings WHERE job_title LIKE 'E2E-HEALTH-%';
  `);
}

test.describe("tab Tình trạng dữ liệu — dữ liệu sạch", () => {
  test("hiện số liệu thiếu field của job và công ty; không có nhóm trùng/hết hạn thì báo rõ", async ({ page }) => {
    test.skip(HAS_E2E_DB, "ca này cần DB sạch; khi có E2E_DATABASE_URL, nhóm ca bên dưới tự chèn và dọn dữ liệu riêng");
    await login(page, ACCOUNTS.crawlStaff.email);
    await page.goto(STATUS_TAB);
    await expect(page.getByRole("navigation", { name: "Các mục vận hành dữ liệu" }).getByRole("link", { name: "Tình trạng dữ liệu" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Thiếu thông tin ở job" })).toBeVisible();
    await expect(page.getByTestId("job-health").locator("tbody tr")).toHaveCount(5);
    await expect(page.getByTestId("job-health")).toContainText("Hạn nộp");
    await expect(page.getByTestId("company-health").locator("tbody tr").first()).toBeVisible();
    await expect(page.getByTestId("company-no-contact")).toContainText(/\d+\/\d+/);
    await expect(page.locator("details[data-source]").first()).toBeVisible();
    await expect(page.getByTestId("duplicates-empty")).toBeVisible();
    await expect(page.getByTestId("expired-empty")).toBeVisible();
  });
});

test.describe.serial("tab Tình trạng dữ liệu — nhóm trùng, hết hạn, đóng job", () => {
  test.skip(!HAS_E2E_DB, "cần E2E_DATABASE_URL để chèn và dọn job thử");

  test.beforeAll(() => {
    cleanupHealthJobs();
    seedHealthJobs();
  });
  test.afterAll(() => {
    cleanupHealthJobs();
  });
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.crawlStaff.email);
  });

  test("số liệu job/công ty hiện cùng nhóm trùng; backend đếm đủ 13 nhóm, trang 1 có 10 nhóm", async ({ page }) => {
    await page.goto(STATUS_TAB);
    await expect(page.getByTestId("job-health").locator("tbody tr")).toHaveCount(5);
    await expect(page.getByTestId("company-no-contact")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job nghi trùng" })).toBeVisible();
    await expect(page.getByText("13 nhóm")).toBeVisible();
    await expect(groups(page)).toHaveCount(10);
    await expect(page.getByTestId("duplicates-empty")).toHaveCount(0);
    await expect(page.getByText("21 job", { exact: true })).toBeVisible();
  });

  test("gợi ý 'Nên giữ' đúng job hạn xa nhất; nhóm cùng hạn không gợi ý", async ({ page }) => {
    await page.goto(STATUS_TAB);
    const top = groupOf(page, "E2E-HEALTH-TOP");
    await expect(top.locator("tbody tr")).toHaveCount(3);
    await expect(top.getByTestId("suggest-keep")).toHaveCount(1);
    const farthest = sql("SELECT to_char(current_date + 90, 'DD/MM/YYYY')");
    await expect(top.locator('tr[data-keep="true"]')).toContainText(farthest);
    await expect(top.getByTestId("no-suggestion")).toHaveCount(0);

    const tie = groupOf(page, "E2E-HEALTH-TIE");
    await expect(tie.locator("tbody tr")).toHaveCount(3);
    await expect(tie.getByTestId("suggest-keep")).toHaveCount(0);
    await expect(tie.getByTestId("no-suggestion")).toBeVisible();
  });

  test("hai bảng phân trang độc lập; trang vượt phạm vi về trang cuối, trang rác về trang 1", async ({ page }) => {
    await page.goto(`${STATUS_TAB}&dup_page=2&exp_page=2`);
    await expect(groups(page)).toHaveCount(3);
    await expect(expiredRows(page)).toHaveCount(1);
    await expect(expiredRows(page).first()).toContainText("E2E-HEALTH-EXP-21");

    const dupNav = page.getByRole("navigation", { name: "Phân trang job nghi trùng" });
    await expect(dupNav).toContainText("Trang 2 / 2");
    await dupNav.getByRole("link", { name: "‹ Trước" }).click();
    // Đổi trang bảng trùng giữ nguyên trang bảng hết hạn.
    await expect(page).toHaveURL(/tab=status&exp_page=2$/);
    await expect(groups(page)).toHaveCount(10);
    await expect(expiredRows(page)).toHaveCount(1);

    await page.goto(`${STATUS_TAB}&dup_page=99`);
    await expect(page).toHaveURL(/dup_page=2$/);
    await expect(groups(page)).toHaveCount(3);

    await page.goto(`${STATUS_TAB}&dup_page=abc&exp_page=-4`);
    await expect(groups(page)).toHaveCount(10);
    await expect(expiredRows(page)).toHaveCount(20);
    await expect(expiredRows(page).first()).toContainText("E2E-HEALTH-EXP-01"); // mới hết hạn gần đây nhất lên đầu
  });

  test("đóng job hết hạn: hộp xác nhận nêu đúng ghi chú, Hủy không đổi gì, xác nhận thì đóng thật và ghi lịch sử", async ({ page }) => {
    await page.goto(STATUS_TAB);
    const jobId = sql("SELECT job_id FROM job_postings WHERE job_title = 'E2E-HEALTH-EXP-01'");

    await closeButton(page, "E2E-HEALTH-EXP-01").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("close-job-note")).toHaveText(EXP_NOTE);
    await page.getByRole("dialog").getByRole("button", { name: "Hủy" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(sql(`SELECT job_status FROM job_postings WHERE job_id = '${jobId}'`)).toBe("OPEN");

    await closeButton(page, "E2E-HEALTH-EXP-01").click();
    await confirmClose(page).click();
    await expect(page.getByText("Đã đóng job.")).toBeVisible();
    await expect(expiredRows(page).filter({ hasText: "E2E-HEALTH-EXP-01" })).toHaveCount(0);
    // 21 -> 20 job: vừa đủ một trang, bộ phân trang của bảng này biến mất.
    await expect(expiredRows(page)).toHaveCount(20);
    await expect(page.getByRole("navigation", { name: "Phân trang job hết hạn" })).toHaveCount(0);

    expect(sql(`SELECT job_status FROM job_postings WHERE job_id = '${jobId}'`)).toBe("CLOSED");
    expect(sql(`SELECT action_type || '|' || note FROM audit_logs WHERE entity_id = '${jobId}'`)).toBe(`DELETE_JOB|${EXP_NOTE}`);
  });

  test("đóng job ở nhóm trùng: dùng câu riêng của bảng trùng; dòng biến mất, nhóm vẫn còn đủ 13", async ({ page }) => {
    await page.goto(STATUS_TAB);
    const top = groupOf(page, "E2E-HEALTH-TOP");
    const later = sql("SELECT to_char(current_date + 30, 'DD/MM/YYYY')");
    const row = top.locator("tbody tr").filter({ hasText: later });
    const jobId = (await row.getAttribute("data-job-id"))!;

    await row.getByRole("button", { name: "Đóng job E2E-HEALTH-TOP" }).click();
    await expect(page.getByTestId("close-job-note")).toHaveText(DUP_NOTE);
    await confirmClose(page).click();
    await expect(page.getByText("Đã đóng job.")).toBeVisible();

    // Nhóm còn 2 job nên được xếp lại cùng các nhóm 2 job (có thể sang trang 2): không dựa vào vị trí, chỉ kiểm job
    // vừa đóng không còn trên trang nào đang xem và số nhóm vẫn là 13 (nhóm chưa biến mất vì vẫn còn 2 job).
    await expect(page.locator(`[data-job-id="${jobId}"]`)).toHaveCount(0);
    await expect(page.getByText("13 nhóm")).toBeVisible();
    expect(sql("SELECT count(*) FROM job_postings WHERE job_title = 'E2E-HEALTH-TOP' AND job_status = 'OPEN'")).toBe("2");
    expect(sql(`SELECT job_status FROM job_postings WHERE job_id = '${jobId}'`)).toBe("CLOSED");
    expect(sql(`SELECT action_type || '|' || note FROM audit_logs WHERE entity_id = '${jobId}'`)).toBe(`DELETE_JOB|${DUP_NOTE}`);
  });

  test("job đã bị xoá từ nơi khác: báo không còn tồn tại và danh sách tự tải lại", async ({ page }) => {
    await page.goto(STATUS_TAB);
    await expect(expiredRows(page).filter({ hasText: "E2E-HEALTH-EXP-02" })).toHaveCount(1);
    sql("DELETE FROM job_postings WHERE job_title = 'E2E-HEALTH-EXP-02'"); // trang đang mở giờ đã cũ

    await closeButton(page, "E2E-HEALTH-EXP-02").click();
    await confirmClose(page).click();
    // Dòng biến mất sau khi tải lại và kéo hộp xác nhận theo, nên thông báo nằm ở toast (không chỉ trong hộp).
    await expect(page.getByText(/không còn tồn tại/).first()).toBeVisible();
    await expect(expiredRows(page).filter({ hasText: "E2E-HEALTH-EXP-02" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
