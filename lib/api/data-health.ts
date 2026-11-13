// lib/api/data-health.ts
// Nhóm 6, tab "Tình trạng dữ liệu" của /crawl. Hai nguồn có YÊU CẦU QUYỀN
// KHÁC HẲN NHAU — khai đúng riêng từng hàm, đừng mặc định cả hai đều cần
// staff:
//   - GET /jobs/data-health       : KHÔNG cần quyền staff, chỉ cần API key
//                                   (giống GET /jobs công khai) -> callPublic
//   - GET /companies/data-health  : cần ss_team (JOIN qua bảng contact, nhạy
//                                   cảm) -> callAuthed
// Trang dùng tab này vẫn tự requireStaff() cả trang; việc ở đây chỉ là gọi
// đúng loại request cho từng route.
//
// ĐẶT TÊN: `company_no_contact_*` ở đây (đếm company active CHƯA có contact,
// phục vụ rà soát chất lượng dữ liệu) là chỉ số ĐỘC LẬP với
// `companies_no_contact` của Dashboard (lọc theo điểm tiềm năng cao). Khi
// viết component, đặt tên biến đủ khác nhau (vd companiesWithoutContactCount
// vs highPotentialCompaniesWithoutContact), đừng gộp chung một tên.

import { callAuthed, callPublic } from "./client";
import type { components } from "./types";

export type JobDataHealth = components["schemas"]["JobDataHealth"];
export type CompanyDataHealth = components["schemas"]["CompanyDataHealth"];
/** 1 job rút gọn trong expired_open_jobs / duplicate_job_groups[].jobs. */
export type JobHealthListItem = components["schemas"]["JobHealthListItem"];
export type DuplicateJobGroup = components["schemas"]["DuplicateJobGroup"];

/** GET /jobs/data-health — public (chỉ API key). Không cache: số liệu đổi theo crawl/đóng job. */
export async function getJobDataHealth(): Promise<JobDataHealth> {
  return callPublic<JobDataHealth>("/jobs/data-health");
}

/** GET /companies/data-health — cần ss_team. */
export async function getCompanyDataHealth(): Promise<CompanyDataHealth> {
  return callAuthed<CompanyDataHealth>("/companies/data-health");
}
