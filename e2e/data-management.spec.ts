import { readFile } from "node:fs/promises";
import { ACCOUNTS, DATA_JOB_TITLE, SEED_JOB_COUNT, expect, login, test } from "./helpers";

// /data-management, phần 1/3: tab Xuất dữ liệu. Chạy với backend + Postgres thật (23 job do
// e2e/global-setup.ts tạo). Tab Nhập dữ liệu chưa làm (phần 2/3) nên chỉ kiểm khung.

test.describe("quyền truy cập", () => {
  test("khách bị chuyển về /login", async ({ page }) => {
    await page.goto("/data-management");
    await expect(page).toHaveURL(/\/login/);
  });

  test("học viên gặp 404, cả trang lẫn route tải file", async ({ page }) => {
    await login(page, ACCOUNTS.dataStudent.email);
    const res = await page.goto("/data-management");
    expect(res?.status()).toBe(404);
    const dl = await page.goto("/data-management/export/job?format=csv");
    expect(dl?.status()).toBe(404);
  });
});

test.describe("staff xuất dữ liệu", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.dataStaff.email);
    await page.goto("/data-management");
  });

  test("mở trang: tab Xuất, entity Job, hai nút tải tắt cho tới khi xem trước", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xuất / Nhập dữ liệu");
    await expect(page.getByRole("tab", { name: "Xuất dữ liệu" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: "Job", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Tải CSV" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Tải Excel/ })).toBeDisabled();
  });

  test("xem trước bật nút tải; sửa bộ lọc thì tắt lại cho tới khi xem trước lại", async ({ page }) => {
    await page.getByRole("button", { name: "Xem trước" }).click();
    await expect(page.getByTestId("export-summary")).toContainText(`${SEED_JOB_COUNT}`);
    await expect(page.getByRole("link", { name: "Tải CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tải Excel/ })).toBeVisible();

    await page.getByLabel("Số dòng mới nhất tối đa").fill("5");
    await expect(page.getByText("Bộ lọc đã thay đổi từ lần xem trước")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tải CSV" })).toBeDisabled();

    await page.getByRole("button", { name: "Xem trước" }).click();
    await expect(page.getByTestId("export-summary")).toContainText("file sẽ có 5 dòng mới nhất");
    await expect(page.getByRole("link", { name: "Tải CSV" })).toBeVisible();
  });

  test("tải CSV: trình duyệt nhận file đúng tên và nội dung", async ({ page }) => {
    await page.getByRole("button", { name: "Xem trước" }).click();
    const link = page.getByRole("link", { name: "Tải CSV" });
    await expect(link).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const path = await download.path();
    const text = await readFile(path, "utf-8");
    expect(text).toContain(DATA_JOB_TITLE);
    expect(text.split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(SEED_JOB_COUNT + 1);
  });

  test("bộ lọc không có dòng nào: báo rõ và không cho tải", async ({ page }) => {
    await page.getByLabel("Trạng thái").selectOption("CLOSED");
    await page.getByRole("button", { name: "Xem trước" }).click();
    await expect(page.getByText("Không có dòng nào khớp bộ lọc")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tải CSV" })).toBeDisabled();
  });

  test("số dòng tối đa không hợp lệ: báo lỗi và tắt nút Xem trước", async ({ page }) => {
    await page.getByLabel("Số dòng mới nhất tối đa").fill("abc");
    // Không dùng getByRole("alert") trơn: Next.js luôn có sẵn một role="alert" (route announcer).
    await expect(page.getByText("Số dòng tối đa phải là số nguyên lớn hơn 0.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem trước" })).toBeDisabled();
  });

  test("đổi entity là điều hướng thật; ô lọc theo từng entity; ?entity= lạ về Job", async ({ page }) => {
    await page.getByRole("link", { name: "Công ty", exact: true }).click();
    await expect(page).toHaveURL(/entity=company/);
    await expect(page.getByLabel("Trạng thái")).toHaveCount(0);
    await expect(page.getByLabel("Hoạt động")).toBeVisible();

    await page.goto("/data-management?entity=contact");
    await expect(page.getByLabel("Trạng thái")).toBeVisible();
    await expect(page.getByLabel("Hoạt động")).toBeVisible();

    await page.goto("/data-management?entity=khong-co");
    await expect(page.getByRole("link", { name: "Job", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("tab Nhập dữ liệu chuyển được mà không mất kết quả xem trước", async ({ page }) => {
    await page.getByRole("button", { name: "Xem trước" }).click();
    await expect(page.getByTestId("export-summary")).toBeVisible();
    await page.getByRole("tab", { name: "Nhập dữ liệu" }).click();
    await expect(page.getByText("sẽ có ở bản cập nhật tiếp theo")).toBeVisible();
    await page.getByRole("tab", { name: "Xuất dữ liệu" }).click();
    await expect(page.getByTestId("export-summary")).toBeVisible();
  });

  test("route tải file từ chối tham số sai bằng trang lỗi (400), không tải file rác", async ({ page }) => {
    const res = await page.goto("/data-management/export/job?format=pdf");
    expect(res?.status()).toBe(400);
    await expect(page.getByText("Định dạng file chỉ nhận xlsx hoặc csv.")).toBeVisible();
  });
});
