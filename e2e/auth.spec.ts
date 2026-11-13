import { ACCOUNTS, SESSION_COOKIES, clientIpHeaders, expect, login, submitLogin, test } from "./helpers";

// Đăng nhập / đăng xuất / chặn khách / session_replaced, chạy với backend thật.

test.describe("khách chưa đăng nhập", () => {
  test("vào trang cần đăng nhập thì bị chuyển sang /login kèm đường quay lại", async ({ page }) => {
    await page.goto("/profile/security");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fsecurity$/);
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("các route staff bị chặn", async ({ page }) => {
    await page.goto("/them-moi");
    await expect(page).toHaveURL(/\/login/);
  });

  test("route mutation chỉ nhận Origin của chính site (verify-origin, chống CSRF)", async ({ request, baseURL }) => {
    // Thiếu Origin lẫn Referer -> từ chối (fail-closed).
    expect((await request.post("/api/auth/logout")).status()).toBe(403);
    // Origin của site khác -> từ chối.
    expect(
      (await request.post("/api/auth/logout", { headers: { Origin: "https://evil.example" } })).status(),
    ).toBe(403);
    // Referer của site khác (không có Origin) -> từ chối.
    expect(
      (await request.post("/api/auth/logout", { headers: { Referer: "https://evil.example/x" } })).status(),
    ).toBe(403);
    // Origin đúng -> qua cổng (đăng xuất khi chưa có phiên vẫn trả ok).
    expect((await request.post("/api/auth/logout", { headers: { Origin: baseURL! } })).status()).toBe(200);
  });

  test("tham số ?reason= lạ không được in ra trang", async ({ page }) => {
    await page.goto("/login?reason=<script>alert(1)</script>");
    // Next tự thêm một phần tử role=alert (route announcer), nên chỉ đếm hộp thông báo của trang.
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });
});

test.describe("đăng nhập", () => {
  test("học viên đăng nhập -> /jobs, cookie phiên httpOnly + secure + lax", async ({ page, context }) => {
    await login(page, ACCOUNTS.authStudent.email);
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByText(ACCOUNTS.authStudent.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();

    const cookies = await context.cookies();
    for (const name of SESSION_COOKIES) {
      const c = cookies.find((x) => x.name === name);
      expect(c, `thiếu cookie ${name}`).toBeDefined();
      expect(c).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
    }
    // Token không được lọt vào JS phía trình duyệt.
    expect(await page.evaluate(() => document.cookie)).not.toContain("mx_");
  });

  test("staff đăng nhập -> /dashboard", async ({ page }) => {
    await login(page, ACCOUNTS.authStaff.email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tổng quan");
  });

  test("sai mật khẩu: báo lỗi, ở lại /login, không có cookie phiên", async ({ page, context }) => {
    await page.goto("/login");
    await submitLogin(page, ACCOUNTS.badPass.email, "mat-khau-sai-123");
    await expect(page.locator("form .bg-red-50")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("mx_access");
    expect(names).not.toContain("mx_refresh");
  });

  test("đăng nhập từ trang bị chặn thì quay lại đúng trang đó", async ({ page }) => {
    await page.goto("/profile/security");
    await expect(page).toHaveURL(/\/login\?next=/);
    await submitLogin(page, ACCOUNTS.authStudent.email);
    await expect(page).toHaveURL(/\/profile\/security$/);
  });

  test("?next= trỏ ra ngoài site bị bỏ qua (chống open-redirect)", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fphish");
    await submitLogin(page, ACCOUNTS.authStudent.email);
    await expect(page).toHaveURL(/\/jobs$/);
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("đã đăng nhập mà vào /login thì được chuyển đi", async ({ page }) => {
    await login(page, ACCOUNTS.authStudent.email);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/jobs$/);
  });
});

test.describe("đăng xuất", () => {
  test("xoá cookie, về /login, rồi không vào lại được trang cần đăng nhập", async ({ page, context }) => {
    await login(page, ACCOUNTS.authStudent.email);
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("mx_access");
    expect(names).not.toContain("mx_refresh");

    await page.goto("/profile/security");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

test.describe("single-session", () => {
  test("đăng nhập ở nơi khác thì phiên cũ bị đá ra kèm thông báo session_replaced", async ({ browser }) => {
    const a = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    const b = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    try {
      const pageA = await a.newPage();
      await login(pageA, ACCOUNTS.replaced.email);
      await pageA.goto("/profile/security");
      await expect(pageA).toHaveURL(/\/profile\/security$/); // phiên A đang tốt

      const pageB = await b.newPage();
      await login(pageB, ACCOUNTS.replaced.email); // thiết bị thứ hai thay thế phiên A

      await pageA.goto("/profile/security");
      await expect(pageA).toHaveURL(/\/login\?.*reason=replaced/);
      await expect(pageA.locator("p[role=alert]")).toContainText("đăng nhập ở một thiết bị khác");

      // Phiên mới (B) vẫn dùng được.
      await pageB.goto("/profile/security");
      await expect(pageB).toHaveURL(/\/profile\/security$/);
    } finally {
      await a.close();
      await b.close();
    }
  });
});
