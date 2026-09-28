// app/(app)/them-moi/page.tsx
// Tương đương add_hub.html + blueprints/add_hub.py (GET /them-moi) bên
// Flask — Nhóm 1, phần 3 của plan (dòng 452, 978). Round 4.
//
// Phạm vi ROUND 4 (đã chốt với user trước khi code):
//   - Tab Job: LÀM THẬT — <JobForm mode="create"> (Round 3) + gọi
//     createJobAction() (viết sẵn từ Round 3, giờ mới thật sự gắn UI).
//   - Tab Công ty / Người liên hệ: lúc đó CHƯA làm (panel tạm), chờ
//     <CompanyForm> đầy đủ + luồng tạo contact ở Nhóm 2 (user chọn
//     "chờ đi, làm đúng quy trình" / "chờ, th ko làm trước plan", không
//     tự ý đi trước plan dù có thể dựng tạm bằng field rút gọn).
//
// Nhóm 2, Phần 1: tab "Công ty" LÀM THẬT — <CompanyForm mode="create">
// (components/company-form.tsx) + createCompanyAction() — quyết định đã
// chốt với user: gắn luôn trong Phần 1, không để riêng.
//
// Nhóm 2, Phần 2 mục 2: tab "Người liên hệ" LÀM THẬT — <ContactForm
// mode="create"> (components/contact-form.tsx) + createContactAction().
// <ComingSoonPanel> không còn tab nào dùng nên đã xoá.
//
// Company list load ĐÚNG 1 LẦN ở đây (Server Component cha), dùng
// chung cho tab Job và tab Người liên hệ
// — đúng lý do _add_hub_context() tồn tại riêng bên Flask (xem docstring
// blueprints/add_hub.py): "company list cần load ĐÚNG 1 LẦN, dùng chung
// cho cả tab job và tab contact... để KHÔNG ai vô tình gọi lại 2-3 lần".
// Tab Công ty KHÔNG cần danh sách này (đang TẠO công ty, không chọn từ
// danh sách có sẵn).
//
// requireStaff() — khớp comment ở lib/auth-guard.ts: "/jobs/add và
// /jobs/[jobId]/edit vẫn requireStaff()". /them-moi thay thế hẳn vai
// trò cũ của /jobs/add (xem 2 link đã sửa ở app/(app)/jobs/page.tsx),
// nên áp dụng đúng guard tương đương.

import { requireStaff } from "@/lib/auth-guard";
import { listAllCompanies } from "@/lib/api/companies";
import { getLevelCodes, getProvinceNames } from "@/lib/api/enums";
import { JobForm } from "@/components/job-form";
import { CompanyForm } from "@/components/company-form";
import { ContactForm } from "@/components/contact-form";
import { AddHubTabs, type AddHubTab } from "./add-hub-tabs";

const VALID_TABS: AddHubTab[] = ["job", "company", "contact"];

export default async function AddHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireStaff();
  const { tab } = await searchParams;
  const activeTab: AddHubTab = VALID_TABS.includes(tab as AddHubTab)
    ? (tab as AddHubTab)
    : "job";

  // Khớp _add_hub_context(): company list dùng chung mọi tab, level +
  // province chỉ tab Job cần (không tải khi chưa dùng tới, nhưng vì
  // Promise.all chạy song song nên không có round-trip thừa đáng kể để
  // phải tách lazy theo tab ở round này).
  const [companies, levels, provinces] = await Promise.all([
    listAllCompanies(),
    getLevelCodes(),
    getProvinceNames(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-2xl font-semibold">Thêm mới</h1>
        <p className="mt-1 text-muted-foreground">
          Thêm job, công ty, hoặc người liên hệ HR mới vào hệ thống.
        </p>
      </header>

      <AddHubTabs
        activeTab={activeTab}
        jobPanel={<JobForm mode="create" companies={companies} levels={levels} provinces={provinces} />}
        companyPanel={<CompanyForm mode="create" />}
        contactPanel={<ContactForm mode="create" companies={companies} />}
      />
    </div>
  );
}
