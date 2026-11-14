import {
  ACCOUNTS,
  HAS_E2E_DB,
  LEGACY_SESSION_COOKIES,
  PASSWORD,
  SESSION_COOKIES,
  changePasswordViaBackend,
  clientIpHeaders,
  expect,
  login,
  sql,
  submitLogin,
  test,
} from "./helpers";

// Vòng đời phiên (Mục 3, Pha B) chạy với backend thật: những cách một phiên chết mà auth.spec.ts chưa chạm tới.
// auth.spec.ts đã có: đăng nhập, đăng xuất, session_replaced. Ở đây:
//   - đổi mật khẩu (thu hồi mọi phiên, xoá cookie, về /login)
//   - đăng xuất ở nơi khác phải thu hồi PHÍA SERVER (xoá cookie thôi thì chưa đủ)
//   - cookie hỏng / cookie JWT cũ: về /login lặng lẽ, không 500, không vòng lặp redirect
//   - hết hạn tuyệt đối / hết hạn trượt: về /login lặng lẽ (token_expired là chuyện bình thường)
//   - tài khoản bị khoá khi đang đăng nhập
// Các ca đụng DB cần E2E_DATABASE_URL (CI luôn có; local thì đặt khi chạy, xem README mục "Test e2e").

const NEW_PASSWORD = "E2e-NewPassw0rd!";

/** Trang cần đăng nhập, dùng để thăm dò "phiên còn sống không". */
const PROTECTED = "/profile/security";

test.describe("đổi mật khẩu", () => {
  test("thành công: về /login, cookie phiên mất, mật khẩu cũ hết dùng được, mật khẩu mới dùng được", async ({
    page,
    context,
  }) => {
    try {
      await login(page, ACCOUNTS.pwChange.email);
      await page.goto(PROTECTED);
      await page.getByLabel("Mật khẩu hiện tại").fill(PASSWORD);
      await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
      await page.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

      // Không giữ phiên hiện tại: route handler xoá cookie ngay, không đợi request sau mới phát hiện.
      await expect(page).toHaveURL(/\/login/);
      const names = (await context.cookies()).map((c) => c.name);
      for (const name of [...SESSION_COOKIES, ...LEGACY_SESSION_COOKIES]) expect(names).not.toContain(name);
      await page.goto(PROTECTED);
      await expect(page).toHaveURL(/\/login\?next=/);

      // Mật khẩu cũ không còn đăng nhập được.
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.pwChange.email, PASSWORD);
      await expect(page.locator("form .bg-red-50")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);

      // Mật khẩu mới thì được.
      await page.getByLabel("Mật khẩu").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Đăng nhập" }).click();
      await expect(page).not.toHaveURL(/\/login/);
    } finally {
      // Trả tài khoản về mật khẩu seed để chạy lại (hoặc retry) không phụ thuộc lần chạy trước.
      await changePasswordViaBackend(ACCOUNTS.pwChange.email, NEW_PASSWORD, PASSWORD).catch(() => {
        // Chưa đổi được ở bước trên thì mật khẩu vẫn là PASSWORD: không có gì để trả.
      });
    }
  });

  test("sai mật khẩu hiện tại: báo lỗi từ backend, phiên giữ nguyên", async ({ page, context }) => {
    await login(page, ACCOUNTS.pwChange.email);
    await page.goto(PROTECTED);
    await page.getByLabel("Mật khẩu hiện tại").fill("khong-phai-mat-khau-hien-tai");
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

    await expect(page.locator("form .bg-red-50")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PROTECTED}$`));
    // Đổi thất bại thì không được thu hồi gì: cookie còn, trang vẫn vào được.
    expect((await context.cookies()).map((c) => c.name)).toContain("mx_session");
    await page.goto(PROTECTED);
    await expect(page).toHaveURL(new RegExp(`${PROTECTED}$`));
  });

  test("đổi mật khẩu ở nơi khác thì phiên này bị thu hồi kèm thông báo session_revoked", async ({ browser }) => {
    const a = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    const b = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    try {
      const pageA = await a.newPage();
      await login(pageA, ACCOUNTS.pwChange.email);
      await pageA.goto(PROTECTED);
      await expect(pageA).toHaveURL(new RegExp(`${PROTECTED}$`));

      // B mang cùng cookie phiên (như thiết bị thứ hai đã lấy được phiên) rồi đổi mật khẩu.
      await b.addCookies(await a.cookies());
      try {
        const pageB = await b.newPage();
        await pageB.goto(PROTECTED);
        await pageB.getByLabel("Mật khẩu hiện tại").fill(PASSWORD);
        await pageB.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
        await pageB.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
        await pageB.getByRole("button", { name: "Đổi mật khẩu" }).click();
        await expect(pageB).toHaveURL(/\/login/);

        // Phiên A cùng token nên chết theo, và là "bị thu hồi" (không phải "bị thay thế").
        await pageA.goto(PROTECTED);
        await expect(pageA).toHaveURL(/\/login\?.*reason=revoked/);
        await expect(pageA.locator("p[role=alert]")).toContainText("Phiên đăng nhập đã kết thúc");
      } finally {
        await changePasswordViaBackend(ACCOUNTS.pwChange.email, NEW_PASSWORD, PASSWORD).catch(() => {});
      }
    } finally {
      await a.close();
      await b.close();
    }
  });
});

test.describe("thu hồi phiên phía server", () => {
  test("đăng xuất ở một nơi làm cookie cùng token ở nơi khác chết theo (session_revoked)", async ({ browser }) => {
    const a = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    const b = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
    try {
      const pageA = await a.newPage();
      await login(pageA, ACCOUNTS.revoke.email);

      // B giữ bản sao cookie phiên rồi đăng xuất bằng giao diện.
      await b.addCookies(await a.cookies());
      const pageB = await b.newPage();
      await pageB.goto("/jobs");
      await pageB.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(pageB).toHaveURL(/\/login$/);

      // Xoá cookie ở B chưa đủ: token phải bị thu hồi ở backend, nếu không A vẫn vào được.
      await pageA.goto(PROTECTED);
      await expect(pageA).toHaveURL(/\/login\?.*reason=revoked/);
      await expect(pageA.locator("p[role=alert]")).toBeVisible();
    } finally {
      await a.close();
      await b.close();
    }
  });
});

test.describe("cookie hỏng", () => {
  const BAD_VALUES: Array<[string, string]> = [
    ["session token giả đúng dạng", "s1.khong-co-trong-db-khong-co-trong-db-khong-co-trong-db"],
    ["chuỗi rác", "rac"],
    ["JWT cũ (cookie còn sót từ trước Pha B)", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.chu-ky-gia"],
  ];

  for (const [label, value] of BAD_VALUES) {
    test(`${label}: về /login lặng lẽ (không thông báo, không 500, không vòng lặp)`, async ({ page, context, baseURL }) => {
      await context.addCookies([
        { name: "mx_session", value, url: baseURL!, httpOnly: true, secure: true, sameSite: "Lax" },
      ]);

      const res = await page.goto(PROTECTED);
      expect(res?.status()).toBeLessThan(500);
      await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fsecurity$/);
      // token_expired là chuyện bình thường: không hiện hộp thông báo "phiên kết thúc".
      await expect(page.locator("p[role=alert]")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();

      // Trang công khai vẫn xem được với cookie hỏng (coi như khách).
      const pub = await page.goto("/jobs");
      expect(pub?.status()).toBe(200);
      await expect(page).toHaveURL(/\/jobs$/);
    });
  }

  test("cookie hỏng không cản đăng nhập lại: cookie mới ghi đè", async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "mx_session", value: "s1.rac", url: baseURL!, httpOnly: true, secure: true, sameSite: "Lax" },
    ]);
    await page.goto("/login");
    await submitLogin(page, ACCOUNTS.authStudent.email);
    await expect(page).toHaveURL(/\/jobs$/);
    await page.goto(PROTECTED);
    await expect(page).toHaveURL(new RegExp(`${PROTECTED}$`));
  });

  test("cookie cũ mx_access / mx_refresh bị proxy xoá khỏi trình duyệt", async ({ page, context, baseURL }) => {
    await context.addCookies(
      LEGACY_SESSION_COOKIES.map((name) => ({
        name,
        value: "gia-tri-cu",
        url: baseURL!,
        httpOnly: true,
        secure: true,
        sameSite: "Lax" as const,
      })),
    );
    await page.goto("/jobs");
    const names = (await context.cookies()).map((c) => c.name);
    for (const name of LEGACY_SESSION_COOKIES) expect(names).not.toContain(name);
  });
});

test.describe("hết hạn và khoá tài khoản (chạm DB e2e)", () => {
  test.skip(!HAS_E2E_DB, "cần E2E_DATABASE_URL để chỉnh hạn phiên / khoá tài khoản trong DB e2e");

  const userId = () =>
    sql(`SELECT ss_user_id FROM app_users WHERE email = '${ACCOUNTS.expiry.email}'`);

  test("hết hạn trượt (nhàn rỗi quá lâu): về /login lặng lẽ", async ({ page }) => {
    await login(page, ACCOUNTS.expiry.email);
    await page.goto(PROTECTED);
    await expect(page).toHaveURL(new RegExp(`${PROTECTED}$`));

    sql(
      `UPDATE auth_sessions SET idle_expires_at = clock_timestamp() - interval '1 minute' ` +
        `WHERE ss_user_id = '${userId()}' AND revoked_at IS NULL`,
    );
    await page.goto(PROTECTED);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
  });

  test("hết hạn tuyệt đối: về /login lặng lẽ", async ({ page }) => {
    await login(page, ACCOUNTS.expiry.email);

    // CHECK trong DB buộc hạn trượt <= hạn tuyệt đối, nên phải kéo cả hai về quá khứ.
    sql(
      `UPDATE auth_sessions SET expires_at = clock_timestamp() - interval '1 minute', ` +
        `idle_expires_at = clock_timestamp() - interval '2 minutes' ` +
        `WHERE ss_user_id = '${userId()}' AND revoked_at IS NULL`,
    );
    await page.goto(PROTECTED);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
  });

  test("tài khoản bị khoá khi đang đăng nhập: bị đưa ra /login, không đăng nhập lại được", async ({ page }) => {
    try {
      await login(page, ACCOUNTS.locked.email);
      await page.goto(PROTECTED);
      await expect(page).toHaveURL(new RegExp(`${PROTECTED}$`));

      sql(`UPDATE app_users SET is_active = false WHERE email = '${ACCOUNTS.locked.email}'`);
      await page.goto(PROTECTED);
      await expect(page).toHaveURL(/\/login\?next=/);

      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.locked.email);
      await expect(page.locator("form .bg-red-50")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      sql(`UPDATE app_users SET is_active = true WHERE email = '${ACCOUNTS.locked.email}'`);
    }
  });
});
