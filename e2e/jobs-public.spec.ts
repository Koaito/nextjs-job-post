import { ACCOUNTS, DATA_JOB_TITLE, SEED_JOB_COUNT, expect, login, test } from "./helpers";

// /jobs là route công khai (khách xem được, không bị chuyển /login) và là điều kiện để SEO hoạt động.
// Dữ liệu: 23 job do e2e/global-setup.ts tạo (1 Data Analysis + 22 Code).

test.describe("khách xem job", () => {
  test("/jobs hiện danh sách mà không bắt đăng nhập", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Job Intern");
    await expect(page.getByText(`Hiển thị 1–20 / ${SEED_JOB_COUNT} job phù hợp`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Đăng nhập", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Thêm job mới/ })).toHaveCount(0);
  });

  test("phân trang giữ đúng số; ?page rác hoặc vượt trần không làm hỏng trang", async ({ page }) => {
    await page.goto("/jobs?page=2");
    await expect(page.getByText(`Hiển thị 21–23 / ${SEED_JOB_COUNT} job phù hợp`)).toBeVisible();

    await page.goto("/jobs?page=abc");
    await expect(page.getByText(`Hiển thị 1–20 / ${SEED_JOB_COUNT} job phù hợp`)).toBeVisible();

    await page.goto("/jobs?page=999");
    await expect(page.getByText(`Hiển thị 21–23 / ${SEED_JOB_COUNT} job phù hợp`)).toBeVisible();
  });

  test("lọc theo từ khoá và theo ngành", async ({ page }) => {
    await page.goto("/jobs?q=Data+Analyst");
    await expect(page.getByText("1 job phù hợp")).toBeVisible();
    await expect(page.getByRole("link", { name: DATA_JOB_TITLE })).toBeVisible();

    await page.goto("/jobs?industry=Data+Analysis");
    await expect(page.getByText("1 job phù hợp")).toBeVisible();

    await page.goto("/jobs?q=khong-co-job-nao-nhu-the");
    await expect(page.getByText("0 job phù hợp")).toBeVisible();
  });

  test("bấm vào job mở trang chi tiết công khai; id lạ -> 404", async ({ page }) => {
    await page.goto("/jobs?q=Data+Analyst");
    await page.getByRole("link", { name: DATA_JOB_TITLE }).click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DATA_JOB_TITLE);

    const res = await page.goto("/jobs/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBe(404);
  });

  test("/jobs/add và /them-moi vẫn cần đăng nhập (không bị mở nhầm bởi route công khai)", async ({ page }) => {
    await page.goto("/jobs/add");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/them-moi");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("học viên đã đăng nhập xem job", () => {
  test("thấy danh sách, không có nút thêm job của staff", async ({ page }) => {
    await login(page, ACCOUNTS.jobsStudent.email);
    await page.goto("/jobs");
    await expect(page.getByText(`Hiển thị 1–20 / ${SEED_JOB_COUNT} job phù hợp`)).toBeVisible();
    await expect(page.getByRole("link", { name: /Thêm job mới/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  });

  test("học viên vào /them-moi (trang của staff) nhận 404, giống Flask trả trang lỗi chung", async ({ page }) => {
    await login(page, ACCOUNTS.jobsStudent.email);
    const res = await page.goto("/them-moi");
    expect(res?.status()).toBe(404);
  });
});
