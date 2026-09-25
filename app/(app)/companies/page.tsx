// app/(app)/companies/page.tsx
// Tương đương companies.html + blueprints/companies.py::index() bên
// Flask (Nhóm 2, Phần 1 của plan). Staff-only — khớp @staff_required ở
// Flask (companies.py) — dùng requireStaff() giống /jobs/[jobId]/edit,
// KHÔNG public như /jobs (dù GET /companies bên FastAPI không đòi role,
// toàn bộ khu vực quản lý công ty vẫn staff-only ở tầng Next.js).
//
// Dropdown "Tỉnh/Thành" để LỌC dùng CITIES_VN TĨNH (đã chốt với user) —
// KHÁC Flask (list_company_cities() quét DB lấy đúng tỉnh đang có), nên
// có thể hiện tỉnh 0 kết quả.

import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { listCompanies, getPartnershipSignals } from "@/lib/api/companies";
import { COMPANIES_PER_PAGE } from "@/lib/constants";
import { suggestPartnershipPotentialFromSignals } from "@/lib/company-potential";
import { CompanyFilterBar } from "./filter-bar";
import { PotentialCell } from "./potential-cell";
import { Pagination } from "../jobs/pagination";

export const metadata = {
  title: "Công ty — MindX Career Hub",
};

interface CompaniesPageSearchParams {
  q?: string;
  city?: string;
  page?: string;
  /** Thông báo 1 lần sau khi điều hướng từ nơi khác về đây (vd xoá công
   *  ty ở delete-company-button.tsx redirect `/companies?notice=...`) —
   *  cùng pattern `notice` đã dùng ở /companies/[companyId]/page.tsx.
   *  Thiếu nhánh này khiến thông báo "Đã xoá công ty." bị mất tích sau
   *  khi xoá — bug tự phát hiện khi rà lại, sửa ở round ngay sau Phần 1. */
  notice?: string;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<CompaniesPageSearchParams>;
}) {
  await requireStaff();
  const params = await searchParams;
  const notice = params.notice;
  const filters = {
    q: (params.q ?? "").trim(),
    city: params.city ?? "",
  };

  const currentParams = new URLSearchParams();
  if (filters.q) currentParams.set("q", filters.q);
  if (filters.city) currentParams.set("city", filters.city);

  let page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  let offset = (page - 1) * COMPANIES_PER_PAGE;
  let data = await listCompanies(filters, { limit: COMPANIES_PER_PAGE, offset });
  let totalPages = Math.max(1, Math.ceil(data.total / COMPANIES_PER_PAGE));

  // Khớp Flask: page vượt quá tổng số trang -> ghim về trang cuối, gọi
  // lại đúng 1 lần (giống app/(app)/jobs/page.tsx).
  if (page > totalPages) {
    page = totalPages;
    offset = (page - 1) * COMPANIES_PER_PAGE;
    data = await listCompanies(filters, { limit: COMPANIES_PER_PAGE, offset });
  }

  const companies = data.items;
  const signals = await getPartnershipSignals(companies.map((c) => c.company_id));

  const from = companies.length ? offset + 1 : 0;
  const to = offset + companies.length;

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Doanh nghiệp</span>
          <h1 className="font-heading text-3xl font-semibold">Database công ty đối tác</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Hồ sơ công ty đã tiếp cận/crawl được — vào từng công ty để xem job đã đăng và quản lý người liên hệ HR.
          </p>
        </div>
        <Link
          href="/them-moi?tab=company"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ＋ Thêm công ty
        </Link>
      </header>

      <CompanyFilterBar />

      <p className="text-sm text-muted-foreground">
        {companies.length > 0
          ? `Hiển thị ${from}–${to} / ${data.total} công ty phù hợp`
          : `${data.total} công ty phù hợp`}
      </p>

      {companies.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Công ty</th>
                  <th className="px-3 py-2 font-medium">Lĩnh vực</th>
                  <th className="px-3 py-2 font-medium">Thành phố</th>
                  <th className="px-3 py-2 font-medium">Quy mô</th>
                  <th className="px-3 py-2 font-medium">Tiềm năng</th>
                  <th className="px-3 py-2 font-medium">Website</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const suggestion = suggestPartnershipPotentialFromSignals(c, signals[c.company_id]);
                  return (
                    <tr key={c.company_id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/companies/${c.company_id}`} className="font-medium underline">
                          {c.company_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.industry || "—"}</td>
                      <td className="px-3 py-2">{c.province_name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.company_size || "—"}</td>
                      <td className="px-3 py-2">
                        <PotentialCell
                          companyId={c.company_id}
                          potential={c.partnership_potential}
                          suggestion={suggestion}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline"
                          >
                            Website ↗
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Link href={`/companies/${c.company_id}`} className="underline">
                            Xem
                          </Link>
                          <Link href={`/companies/${c.company_id}/edit`} className="underline">
                            Sửa
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/companies" currentParams={currentParams} page={page} totalPages={totalPages} />
        </>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">Chưa có công ty nào khớp bộ lọc.</p>
          <Link
            href="/them-moi?tab=company"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Thêm công ty đầu tiên
          </Link>
        </div>
      )}
    </div>
  );
}
