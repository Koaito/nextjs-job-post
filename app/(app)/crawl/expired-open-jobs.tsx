// app/(app)/crawl/expired-open-jobs.tsx
// Bảng "đã hết hạn nhưng vẫn Đang tuyển". Bản Flask chỉ liệt kê kèm gợi ý "chạy job bảo trì ở tab khác"; ở đây mỗi dòng
// có nút đóng tại chỗ, dùng lại đúng action của bảng nhóm trùng nhưng với ghi chú riêng (kind="expired").

import Link from "next/link";
import type { JobHealthListItem } from "@/lib/api/data-health";
import { deadlineLabel } from "@/lib/data-ops/data-health";
import { CloseJobButton } from "./close-job-button";

export function ExpiredOpenJobsTable({ jobs }: { jobs: JobHealthListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label="Job đã hết hạn nhưng vẫn Đang tuyển" className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Job
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Công ty
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nguồn
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Hạn nộp
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {jobs.map((j) => (
            <tr key={j.id} data-job-id={j.id}>
              <td className="px-3 py-2">
                <Link href={`/jobs/${j.id}`} className="underline-offset-2 hover:underline">
                  {j.position}
                </Link>
              </td>
              <td className="px-3 py-2">{j.company}</td>
              <td className="px-3 py-2">{j.source}</td>
              <td className="px-3 py-2 font-mono">{deadlineLabel(j.deadline)}</td>
              <td className="px-3 py-2 text-right">
                <CloseJobButton jobId={j.id} jobTitle={j.position} kind="expired" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
