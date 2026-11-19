This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Type API (OpenAPI)

`lib/api/types.ts` được **sinh tự động**, không sửa tay. Nguồn là `openapi/openapi.snapshot.json`, bản copy của
`openapi.snapshot.json` ở repo backend (Scrap JD), nơi có test giữ cho nó khớp API.

Khi backend đổi API (đã commit snapshot mới ở backend):

```bash
npm run sync:openapi -- "đường/dẫn/tới/Scrap JD"   # copy snapshot + sinh lại types.ts
npm run typecheck && npm test                     # xem code nào lệch kiểu
```

Rồi commit cả `openapi/openapi.snapshot.json` và `lib/api/types.ts`. Chỉ sinh lại types từ bản copy hiện có:
`npm run gen:types`. CI chạy `gen:types` rồi so với bản đã commit, nên sửa tay `types.ts` hoặc đổi snapshot mà quên
sinh lại sẽ làm CI đỏ. CI **không** tự biết backend đã đổi: bước đồng bộ ở trên vẫn là việc chạy tay.

## Test e2e (Playwright)

`e2e/` chạy trình duyệt thật → Next.js (bản build) → backend Scrap JD thật → Postgres thật, không mock gì ở giữa.
Hiện có 7 spec: `auth` (đăng nhập, đăng xuất, chặn khách, chống open-redirect, verify-origin, `session_replaced`),
`session-lifecycle` (đổi mật khẩu, thu hồi phiên phía server, cookie hỏng, hết hạn, tài khoản bị khoá),
`jobs-public` (xem `/jobs` khi chưa đăng nhập, phân trang, lọc, 404) và `messages` (yêu cầu nhắn tin, chấp nhận,
polling, tin chứa HTML hiện thành chữ thô) và `data-management` (quyền truy cập, xem trước rồi mới tải,
nút tải tắt khi bộ lọc đổi, tải CSV thật, đổi entity) và `data-import` (tab Nhập dữ liệu: file bị từ chối, sửa ô
lỗi, chọn level, chọn công ty, cặp liên hệ trùng trong file, ghi chú bắt buộc, nhập thật Company/Contact; không tạo Job
thật vì `jobs-public` đếm đúng 23 job). Các ca hết hạn / khoá tài khoản chỉnh thẳng DB e2e nên cần
`E2E_DATABASE_URL` (không đặt thì tự bỏ qua). Spec `crawl` (`/crawl`, phần 3a–3d: quyền truy cập, 4 tab, widget "Đang chạy"
hiện chéo, polling dừng khi sang tab Lịch sử, hai bảng lịch sử lọc/phân trang độc lập, tab Crawl: checklist batch,
log live, form chạy và route POST chỉ admin; tab Bảo trì: 5 thẻ, số liệu theo job, log gộp một request, form theo
quy tắc từng job, route POST chỉ admin, ca lượt đang chạy xong chuyển trạng thái qua DB e2e) đọc dữ liệu lịch sử nạp sẵn trong
`e2e/seed.sql` và KHÔNG bấm chạy crawl/bảo trì thật (sẽ gọi TopCV/Tavily/Gemini). Ca "chạy" duy nhất nhắm vào nguồn `careerviet` (seed
đang có lượt chạy dở) nên backend trả 409 ngay ở bước tạo run, trước khi có tác vụ nền nào chạy; mỗi lần chạy spec chạm
backend đúng 1 lần ở POST crawl và 1 lần ở POST bảo trì (backend giới hạn 10 lượt/giờ/người, tính riêng từng route).
Tab Bảo trì: ca 409 nhắm vào `check_expired_jobs` (seed đang có lượt chạy dở); ca 429 trên thẻ giả lập ở trình duyệt vì
không thể tạo thật mà không đốt hạn mức. Ca "lượt đang chạy xong" cần `E2E_DATABASE_URL` (tự bỏ qua nếu thiếu) và tự trả DB về như seed.
Spec `data-health` (`/crawl?tab=status`, phần 3e): số liệu thiếu field của job/công ty, nhóm job nghi trùng kèm gợi ý
"Nên giữ" do backend tính, job hết hạn nhưng vẫn Đang tuyển, hai bảng phân trang độc lập (`dup_page`, `exp_page`), nút
"Đóng job này" đóng THẬT qua PATCH /jobs/{id} bằng tài khoản ss_team rồi kiểm `audit_logs` (ghi chú cố định do server điền).
Dữ liệu seed gốc không có nhóm trùng/job hết hạn nên ca đầu kiểm trạng thái rỗng (chạy khi KHÔNG đặt `E2E_DATABASE_URL`);
các ca còn lại tự chèn job `E2E-HEALTH-*` bằng SQL và dọn ở `afterAll` (cần `E2E_DATABASE_URL`), vì `jobs-public` đếm đúng 23 job.
Spec `crawl-tabs` (phần 3f, hành vi chéo tab): mỗi tab chỉ gọi endpoint của nó (tab Lịch sử không có request `/api`
nào, tab Tình trạng dữ liệu chỉ poll widget, tab Crawl và tab Bảo trì không poll API của nhau), tab trình duyệt bị ẩn thì
không poll và quay lại thì cập nhật ngay, phiên chết (đăng nhập nơi khác) thì cả 4 tab về `/login?reason=replaced`.
`reuseExistingServer` bật ngoài CI: nếu còn một `next start` cũ trên cổng 3100 thì Playwright dùng lại nó (bản build cũ,
nhóm ca này sẽ đỏ giả), nên tắt server cũ trước khi chạy lại sau khi build lại.

Kiểm lộ khoá trong bản build: sau `npm run build`, chạy `npm run check:secrets` (đặt cùng `CRAWLER_API_KEY` và
`CRAWLER_API_URL` đã dùng khi build). Script quét `.next/static` tìm GIÁ TRỊ khoá/URL backend và TÊN biến server
(tên xuất hiện nghĩa là một module server-only bị import nhầm vào Client Component); thoát mã 1 nếu phát hiện. CI chạy
bước này sau Build. `tests/route-guards.test.ts` rà tĩnh mọi route ghi dưới `app/api` phải có `verifyOrigin`.

Chạy local (cần repo backend, Postgres và `psql`):

```bash
# 1. Postgres riêng cho e2e; tên database PHẢI chứa "e2e" hoặc "test" (script từ chối tên khác vì nó xoá sạch dữ liệu)
createdb scrapjd_e2e

# 2. Backend: dựng schema rồi chạy (trong repo Scrap JD)
export PGHOST=localhost PGPORT=5432 PGDATABASE=scrapjd_e2e PGUSER=postgres PGPASSWORD=... PGSSLMODE=disable
export API_KEY=e2e-api-key-not-a-secret JWT_SECRET_KEY=e2e-jwt-secret-not-a-secret-0123456789abcdef
export ALLOWED_ORIGINS=http://localhost:3100
python main.py init-db
python -m uvicorn scrapjd.api.app:app --port 8000

# 3. Frontend (trong repo này): build một lần, rồi chạy test
export CRAWLER_API_URL=http://127.0.0.1:8000 CRAWLER_API_KEY=e2e-api-key-not-a-secret NEXT_PUBLIC_APP_URL=http://localhost:3100
npm run build
npx playwright install chromium            # lần đầu
export E2E_DATABASE_URL=postgresql://postgres:...@localhost:5432/scrapjd_e2e
npm run test:e2e
```

Có `E2E_DATABASE_URL` thì mỗi lượt chạy tự nạp lại dữ liệu nền (`e2e/seed.sql`: xoá sạch rồi tạo tài khoản mẫu);
không có thì phải tự chạy `npm run e2e:db` trước, vì spec nhắn tin cần DB chưa có hội thoại nào. Công ty và job mẫu
do `e2e/global-setup.ts` tạo qua REST. Mọi tài khoản mẫu dùng mật khẩu `E2e-Passw0rd!` (chỉ có hiệu lực trên DB e2e);
mỗi spec dùng tài khoản riêng vì backend chỉ cho một phiên đăng nhập cùng lúc cho mỗi tài khoản.

Backend giới hạn tốc độ (đăng nhập 20 lần/phút theo IP, danh sách hội thoại 10 lần/phút theo người dùng). Mỗi test tự
khai một IP khách riêng qua `x-forwarded-for` (xem `e2e/helpers.ts`) nên chạy lại liên tục hoặc retry không dính 429.
Tự tạo `browser.newContext()` trong spec thì phải truyền `extraHTTPHeaders: clientIpHeaders()`.

CI: `.github/workflows/e2e.yml` (cần khai báo biến Actions `BACKEND_REPO`, xem chú thích đầu file).
