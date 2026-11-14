import type { Page } from "@playwright/test";
import { ACCOUNTS, clientIpHeaders, expect, login, test } from "./helpers";

// Luồng nhắn tin thật giữa một học viên và một SS, hai trình duyệt riêng:
//   học viên gửi tin đầu -> chỉ tạo YÊU CẦU (không có tin nào được lưu)
//   SS chấp nhận -> hai bên nhắn được, tin mới tới bên kia qua polling (không reload)
// Các bước phụ thuộc nhau (trạng thái quan hệ sống trong DB) nên chạy tuần tự, dừng ngay khi một bước hỏng.
//
// Backend giới hạn tốc độ theo từng người dùng (gửi 1 tin/giây và 20/phút, danh sách hội thoại 10/phút),
// nên spec này cố ý ít lần tải trang và gửi tin qua sendMessage() (luôn chờ đủ khoảng nghỉ giữa hai tin của
// CÙNG một người). Không được gửi bằng fill + click trực tiếp: nếu hai lần gửi cách nhau dưới 1 giây thì tin
// thứ hai bị 429, giao diện gỡ bong bóng tạm và hiện toast lỗi, còn test có thể đạt oan nhờ bong bóng tạm.
//
// retries: 0 vì các test trong nhóm dựa vào trạng thái quan hệ đã ghi vào DB; chạy lại giữa chừng không cho
// trạng thái ban đầu nên chỉ che lỗi gốc bằng một lỗi khác (vd "chờ SS chấp nhận" không còn hiện).

test.describe.configure({ mode: "serial", retries: 0 });

/** Khoảng nghỉ tối thiểu giữa hai tin của cùng một người, lớn hơn giới hạn 1 tin/giây của backend. */
const MIN_SEND_GAP_MS = 1_200;
const lastSendAt = new WeakMap<Page, number>();

/** Điền và gửi một tin, chờ đủ MIN_SEND_GAP_MS kể từ lần gửi trước của trang này. */
async function sendMessage(page: Page, text: string) {
  const wait = MIN_SEND_GAP_MS - (Date.now() - (lastSendAt.get(page) ?? 0));
  if (wait > 0) await page.waitForTimeout(wait);
  await page.getByLabel("Nội dung tin nhắn").fill(text);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  lastSendAt.set(page, Date.now());
}

/** Bong bóng của tin ĐÃ LƯU (có data-id). Bong bóng tạm "Đang gửi…" không có data-id và biến mất nếu gửi lỗi. */
const saved = (page: Page, partnerName: string, text: string) =>
  log(page, partnerName).locator("[data-id]", { hasText: text });

const log = (page: Page, partnerName: string) =>
  page.getByRole("log", { name: `Tin nhắn với ${partnerName}` });

test.describe("nhắn tin học viên <-> SS", () => {
  let studentPage: Page;
  let ssPage: Page;

  test.beforeAll(async ({ browser }) => {
    studentPage = await (await browser.newContext({ extraHTTPHeaders: clientIpHeaders() })).newPage();
    ssPage = await (await browser.newContext({ extraHTTPHeaders: clientIpHeaders() })).newPage();
    await login(studentPage, ACCOUNTS.msgStudent.email);
    await login(ssPage, ACCOUNTS.msgSs.email);
  });

  test.afterAll(async () => {
    await studentPage.context().close();
    await ssPage.context().close();
  });

  test("khách chưa đăng nhập vào /messages bị chuyển /login", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/login\?next=%2Fmessages/);
  });

  test("học viên tìm SS rồi gửi tin đầu: chỉ tạo yêu cầu, chưa có tin nào", async () => {
    await studentPage.goto("/messages/new");
    await studentPage.getByLabel("Tìm theo tên").fill("Mai Linh");
    await studentPage.getByRole("button", { name: "Tìm" }).click();
    await studentPage.getByRole("link", { name: new RegExp(ACCOUNTS.msgSs.name) }).click();

    await expect(studentPage.getByRole("heading", { level: 1 })).toContainText(ACCOUNTS.msgSs.name);
    await expect(studentPage.getByText(/Chưa có tin nhắn nào/)).toBeVisible();

    await sendMessage(studentPage, "Em chào chị, em muốn hỏi về job intern ạ.");

    await expect(studentPage.getByText(/chờ SS chấp nhận/)).toBeVisible();
    // Yêu cầu chưa được chấp nhận thì tin KHÔNG được lưu, nên không có bong bóng nào.
    await expect(log(studentPage, ACCOUNTS.msgSs.name).getByText("Em chào chị")).toHaveCount(0);
  });

  test("SS thấy yêu cầu đang chờ và chấp nhận", async () => {
    await ssPage.goto("/messages");
    await expect(ssPage.getByRole("heading", { name: /Yêu cầu đang chờ \(1\)/ })).toBeVisible();
    await expect(ssPage.getByText(ACCOUNTS.msgStudent.name)).toBeVisible();

    await ssPage.getByRole("button", { name: `Chấp nhận yêu cầu của ${ACCOUNTS.msgStudent.name}` }).click();
    await expect(ssPage.getByRole("heading", { name: /Yêu cầu đang chờ/ })).toHaveCount(0);
  });

  test("sau khi được chấp nhận, học viên nhắn được và tin hiện ngay", async () => {
    await studentPage.reload();
    const messages = log(studentPage, ACCOUNTS.msgSs.name);
    await sendMessage(studentPage, "Em cảm ơn chị đã chấp nhận ạ.");
    // Phải là tin ĐÃ LƯU (data-id), không chỉ bong bóng tạm: gửi lỗi (429...) cũng từng hiện bong bóng tạm một lúc.
    await expect(saved(studentPage, ACCOUNTS.msgSs.name, "Em cảm ơn chị đã chấp nhận ạ.")).toBeVisible();
    await expect(messages.getByText("Đang gửi…")).toHaveCount(0); // tin tạm đã được thay bằng tin thật
  });

  test("SS nhận được tin ở hội thoại, và trả lời; học viên nhận qua polling không cần tải lại", async () => {
    await ssPage.goto("/messages");
    await ssPage.getByRole("link", { name: new RegExp(ACCOUNTS.msgStudent.name) }).first().click();
    const ssLog = log(ssPage, ACCOUNTS.msgStudent.name);
    await expect(ssLog.getByText("Em cảm ơn chị đã chấp nhận ạ.")).toBeVisible();

    await sendMessage(ssPage, "Chào em, chị trả lời ngay đây.");
    await expect(saved(ssPage, ACCOUNTS.msgStudent.name, "Chào em, chị trả lời ngay đây.")).toBeVisible();

    // Học viên KHÔNG reload: tin phải tới qua polling (chu kỳ cơ bản 5 giây).
    await expect(log(studentPage, ACCOUNTS.msgSs.name).getByText("Chào em, chị trả lời ngay đây.")).toBeVisible({
      timeout: 25_000,
    });
  });

  test("tin chứa HTML hiện thành chữ thô, không chạy script", async () => {
    const payload = '<b>đậm</b><img src=x onerror="window.__xss=1">';
    let dialogs = 0;
    studentPage.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });

    await sendMessage(studentPage, payload);

    const messages = log(studentPage, ACCOUNTS.msgSs.name);
    await expect(saved(studentPage, ACCOUNTS.msgSs.name, payload)).toBeVisible();
    await expect(messages.locator("b, img")).toHaveCount(0);
    expect(await studentPage.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toBe(0);

    // SS cũng thấy chữ thô (nhận qua polling).
    await expect(log(ssPage, ACCOUNTS.msgStudent.name).getByText(payload)).toBeVisible({ timeout: 25_000 });
    await expect(log(ssPage, ACCOUNTS.msgStudent.name).locator("b, img")).toHaveCount(0);
  });

  test("tin chỉ có khoảng trắng bị chặn ngay ở client, không tạo tin nào", async () => {
    const messages = log(studentPage, ACCOUNTS.msgSs.name);
    const before = await messages.locator("[data-id]").count();

    await studentPage.getByLabel("Nội dung tin nhắn").fill("   ");
    await studentPage.getByRole("button", { name: "Gửi", exact: true }).click();
    await expect(messages.locator("[data-id]")).toHaveCount(before);
    await expect(studentPage.getByLabel("Nội dung tin nhắn")).toHaveValue("   "); // giữ nguyên chữ
  });
});
