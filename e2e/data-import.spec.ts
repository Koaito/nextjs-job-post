import { ACCOUNTS, expect, login, test } from "./helpers";
import type { Page } from "@playwright/test";

// /data-management, phần 2/3: tab Nhập dữ liệu. Chạy với backend + Postgres thật. Không tạo Job thật
// (jobs-public.spec.ts đếm đúng 23 job); các ca GHI THẬT dùng Company/Contact với tên có dấu thời gian
// để chạy lại trên cùng một DB vẫn không trùng.

const STAMP = Date.now();

function csv(name: string, text: string) {
  return { name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") };
}

async function openImport(page: Page, entity: "job" | "company" | "contact") {
  await page.goto(`/data-management?entity=${entity}`);
  await page.getByRole("tab", { name: "Nhập dữ liệu" }).click();
}

async function upload(page: Page, file: ReturnType<typeof csv>) {
  await page.getByTestId("import-file").setInputFiles(file);
  await page.getByTestId("import-upload").click();
}

test.describe("quyền truy cập", () => {
  test("học viên không vào được trang, và không gọi được route nhập", async ({ page }) => {
    await login(page, ACCOUNTS.dataStudent.email);
    expect((await page.goto("/data-management"))?.status()).toBe(404);
    const res = await page.request.get("/api/import/job/preview/11111111-1111-4111-8111-111111111111");
    expect(res.status()).toBe(403);
  });

  test("POST từ nguồn lạ bị chặn 403 dù đã đăng nhập", async ({ page }) => {
    await login(page, ACCOUNTS.importStaff.email);
    const res = await page.request.post("/api/import/company/confirm", {
      headers: { origin: "http://evil.test" },
      data: { preview_id: "11111111-1111-4111-8111-111111111111", note: "x", resolutions: {} },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("staff nhập dữ liệu", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.importStaff.email);
  });

  test("kiểm file ngay ở client: sai đuôi thì báo và không gọi mạng", async ({ page }) => {
    await openImport(page, "company");
    let called = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/import/")) called = true;
    });
    await page.getByTestId("import-file").setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await page.getByTestId("import-upload").click();
    await expect(page.getByTestId("import-upload-error")).toContainText(".csv hoặc .xlsx");
    expect(called).toBe(false);
  });

  test("file thiếu cột bắt buộc bị từ chối: hiện lỗi cấp dòng, không vào bước xem lại", async ({ page }) => {
    await openImport(page, "company");
    await upload(page, csv("thieu-cot.csv", "website\nhttps://x.example\n"));
    await expect(page.getByTestId("import-row-errors")).toContainText("Thiếu cột bắt buộc: company_name");
    await expect(page.getByTestId("import-upload")).toBeVisible();
  });

  test("Job: dòng cần xử lý bị chặn tới khi sửa ô, chọn level, chọn công ty; chuyển tab không mất", async ({ page }) => {
    await openImport(page, "job");
    await upload(
      page,
      csv(
        "jobs.csv",
        [
          "job_title,company_name,deadline,level_code",
          `E2E Import Job A ${STAMP},E2E Công ty Alpha,2030-01-01,Intern`,
          `E2E Import Job B ${STAMP},E2E Cong ty Alpha,2030-01-01,Intern`,
          `E2E Import Job C ${STAMP},E2E Công ty Alpha,31/31/2030,Xyz`,
        ].join("\n"),
      ),
    );

    await expect(page.getByTestId("import-summary")).toContainText("Tổng dòng: 3");
    await expect(page.getByTestId("import-blocked")).toHaveText("2");
    // Mặc định chỉ hiện dòng cần xử lý: dòng 0 (mới, sạch) ẩn
    await expect(page.getByTestId("import-row-0")).toHaveCount(0);

    // Bấm xác nhận khi còn dòng chưa xong -> báo rõ, nút KHÔNG bị tắt
    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-error")).toContainText("Còn 2 dòng chưa xử lý xong");
    await expect(page.getByTestId("import-confirm")).toBeEnabled();

    // Dòng 2: sửa ô deadline sai rồi đúng, chọn lại level
    const row2 = page.getByTestId("import-row-2");
    await expect(row2).toContainText("Dòng 4"); // dòng 4 trong file (tính cả tiêu đề)
    const cell = row2.getByTestId("fix-deadline");
    // Giá trị thô sai định dạng ("31/31/2030") không nạp vào ô ngày: ô trống, nút xác nhận tắt
    await expect(cell.getByLabel("Sửa deadline")).toHaveValue("");
    await expect(cell.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    await expect(row2.getByTestId("blocker-fix")).toBeVisible();

    await cell.getByLabel("Sửa deadline").fill("2030-05-05");
    await cell.getByRole("button", { name: "Xác nhận" }).click();
    await expect(row2.getByTestId("fix-ok-deadline")).toBeVisible();
    await expect(row2.getByTestId("blocker-fix")).toHaveCount(0);
    await expect(row2.getByTestId("blocker-level")).toBeVisible();

    // Sửa lại ô đã xác nhận thì gỡ trạng thái xác nhận của đúng ô đó
    await cell.getByLabel("Sửa deadline").fill("2030-06-06");
    await expect(row2.getByTestId("fix-ok-deadline")).toHaveCount(0);
    await expect(row2.getByTestId("blocker-fix")).toBeVisible();
    await cell.getByRole("button", { name: "Xác nhận" }).click();
    await expect(row2.getByTestId("fix-ok-deadline")).toBeVisible();

    await row2.getByLabel("Chọn lại level").selectOption("Intern");
    await expect(row2.getByTestId("blocker-level")).toHaveCount(0);
    await expect(page.getByTestId("import-blocked")).toHaveText("1");

    // Dòng 1: công ty chưa có -> hộp chọn công ty (backend resolve thật)
    const row1 = page.getByTestId("import-row-1");
    await expect(row1).toContainText("Chưa chọn công ty");
    await row1.getByRole("button", { name: "Chọn công ty…" }).click();
    const choices = page.getByTestId("company-choices");
    await expect(choices).toContainText("E2E Công ty Alpha");
    await expect(choices).toContainText("Tạo công ty mới");
    await expect(page.getByRole("button", { name: "Xác nhận", exact: true })).toBeDisabled();
    await choices.getByText("E2E Công ty Alpha").click();
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(row1).not.toContainText("Chưa chọn công ty");
    await expect(page.getByTestId("import-blocked")).toHaveText("0");
    await expect(page.getByTestId("import-plan")).toContainText("tạo mới 3");

    // Chuyển sang tab Xuất rồi quay lại: vẫn đang xem lại file, không mất việc đã làm
    await page.getByRole("tab", { name: "Xuất dữ liệu" }).click();
    await page.getByRole("tab", { name: "Nhập dữ liệu" }).click();
    await expect(page.getByTestId("import-plan")).toContainText("tạo mới 3");

    // Hủy: về khung tải file, KHÔNG ghi gì vào hệ thống
    await page.getByRole("button", { name: "Hủy, tải file khác" }).click();
    await expect(page.getByTestId("import-upload")).toBeVisible();
  });

  test("Company: dòng no_conflict có ô lỗi phải sửa mới nhập được; cần ghi chú; nhập xong form về trống", async ({ page }) => {
    await openImport(page, "company");
    await upload(page, csv("cong-ty.csv", `company_name,website\n,https://x.example\nE2E Import Co ${STAMP},\n`));

    const row0 = page.getByTestId("import-row-0");
    await expect(row0.getByTestId("blocker-fix")).toBeVisible();
    // Dòng no_conflict không có lựa chọn "bỏ qua" (backend luôn tạo mới dòng này)
    await expect(row0.getByRole("combobox")).toHaveCount(0);

    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-error")).toContainText("Còn 1 dòng chưa xử lý xong");

    const cell = row0.getByTestId("fix-company_name");
    await cell.getByLabel("Sửa company_name").fill(`E2E Import Fixed ${STAMP}`);
    await cell.getByRole("button", { name: "Xác nhận" }).click();
    await expect(row0.getByTestId("fix-ok-company_name")).toBeVisible();
    await expect(page.getByTestId("import-blocked")).toHaveText("0");

    // Thiếu ghi chú -> báo, nút vẫn bấm lại được
    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-error")).toContainText("ghi chú");
    await expect(page.getByTestId("import-confirm")).toBeEnabled();

    await page.locator("#import-note").fill("E2E nhập công ty");
    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-result")).toContainText("Tạo mới 2, cập nhật 0, bỏ qua 0.");
    await expect(page.getByTestId("import-upload")).toBeVisible();
    await expect(page.getByTestId("import-file")).toHaveValue("");
  });

  test("Contact: sửa một ô làm dòng KHÁC thành trùng trong file; một lựa chọn cho cả cặp", async ({ page }) => {
    const email = `e2e.dup.${STAMP}@imp.test`;
    await openImport(page, "contact");
    await upload(
      page,
      csv(
        "lien-he.csv",
        [
          "contact_name,work_email,company_name",
          `An Nguyen,${email},E2E Công ty Alpha`,
          "An Nguyen,not-an-email,E2E Công ty Alpha",
        ].join("\n"),
      ),
    );

    // Ban đầu chỉ dòng 1 (dòng 3 trong file) có ô lỗi
    await expect(page.getByTestId("import-row-0")).toHaveCount(0);
    const row1 = page.getByTestId("import-row-1");
    await expect(row1.getByTestId("blocker-fix")).toBeVisible();

    const cell = row1.getByTestId("fix-work_email");
    // Giá trị vẫn sai -> backend từ chối, hiện lỗi nguyên văn, ô chưa được coi là xong
    await cell.getByLabel("Sửa work_email").fill("van-sai-email");
    await cell.getByRole("button", { name: "Xác nhận" }).click();
    await expect(cell.getByText(/không hợp lệ/)).toBeVisible();
    await expect(row1.getByTestId("fix-ok-work_email")).toHaveCount(0);
    await expect(row1.getByTestId("blocker-fix")).toBeVisible();

    await cell.getByLabel("Sửa work_email").fill(email);
    await cell.getByRole("button", { name: "Xác nhận" }).click();

    // Backend đổi ngầm CẢ dòng 0 sang "trùng trong file": chỉ thấy được vì tải lại cả preview
    const row0 = page.getByTestId("import-row-0");
    await expect(row0).toContainText("Trùng dòng khác trong file");
    await expect(row1).toContainText("Trùng dòng khác trong file");
    await expect(page.getByTestId("import-blocked")).toHaveText("2");

    // Một quyết định cho cả cặp (dòng 2 và dòng 3 trong file)
    await row0.getByRole("button", { name: "Giữ dòng 2, bỏ dòng 3" }).click();
    await expect(page.getByTestId("import-blocked")).toHaveText("0");
    await expect(row0).toContainText("được tạo mới");
    await expect(row1).toContainText("bị bỏ qua");
    await expect(page.getByTestId("import-plan")).toContainText("tạo mới 1");

    await page.locator("#import-note").fill("E2E nhập liên hệ");
    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-result")).toContainText("Tạo mới 1, cập nhật 0, bỏ qua 1.");
  });
});
