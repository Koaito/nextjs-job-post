// app/(app)/data-management/page.tsx
// Tương đương data_management.html + blueprints/data_management.py (Flask) — "Xuất / Nhập dữ liệu".
// Nhóm 6, LÀM THEO 3 PHẦN:
//   [x] Phần 1/3 — khung trang, chọn entity, tab Xuất dữ liệu (xem trước -> tải Excel/CSV)
//   [x] Phần 2/3 — tab Nhập dữ liệu (upload -> preview -> sửa lỗi -> công ty trùng -> confirm)
//   [ ] Phần 3/3 — /crawl (4 tab), chia nhỏ 3a–3f: xem app/(app)/crawl/page.tsx
//
// CHỈ STAFF: requireStaff() (ss_team là đủ; route import/export không có nhánh admin-only).
// Đổi entity (Job/Company/Contact) là ĐIỀU HƯỚNG thật (?entity=), nên mỗi entity có URL riêng và
// state của form lọc tự reset (panel dựng lại theo `key`). Đổi tab Xuất <-> Nhập là thuần client.
// ?entity= lạ/thiếu -> "job" như Flask, không 404.

import { getLevelCodes } from "@/lib/api/enums";
import { requireStaff } from "@/lib/auth-guard";
import { parseEntityParam } from "@/lib/data-ops/export-ui";
import { DataManagementEntityNav } from "./entity-nav";
import { DataManagementTabs } from "./data-management-tabs";

export const dynamic = "force-dynamic";

export default async function DataManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const entity = parseEntityParam((await searchParams).entity);
  const levelCodes = await getLevelCodes();

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Xuất / Nhập dữ liệu</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Tải dữ liệu job, công ty, contact ra file Excel hoặc CSV, hoặc nhập hàng loạt từ file.
        </p>
      </header>

      <DataManagementEntityNav entity={entity} />
      <DataManagementTabs key={entity} entity={entity} levelCodes={levelCodes} />
    </div>
  );
}
