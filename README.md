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
Hiện có 3 spec: `auth` (đăng nhập, đăng xuất, chặn khách, chống open-redirect, verify-origin, `session_replaced`),
`jobs-public` (xem `/jobs` khi chưa đăng nhập, phân trang, lọc, 404) và `messages` (yêu cầu nhắn tin, chấp nhận,
polling, tin chứa HTML hiện thành chữ thô).

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
