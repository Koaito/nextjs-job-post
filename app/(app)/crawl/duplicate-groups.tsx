// app/(app)/crawl/duplicate-groups.tsx
// Bảng nhóm job nghi trùng (cùng công ty + cùng vị trí, đang mở). Backend đã nhóm sẵn và tính `suggest_keep`
// (job có deadline xa nhất); frontend chỉ hiển thị, không tự so lại. Không có gợi ý (null) thì nói rõ "chưa đủ căn cứ",
// để người xem tự quyết, không đoán bừa.

import Link from "next/link";
import type { DuplicateJobGroup } from "@/lib/api/data-health";
import { deadlineLabel, keepJobId } from "@/lib/data-ops/data-health";
import { CloseJobButton } from "./close-job-button";

export function DuplicateGroups({ groups }: { groups: DuplicateJobGroup[] }) {
  return (
    <ul data-testid="duplicate-groups" className="space-y-4">
      {groups.map((g, i) => {
        const keep = keepJobId(g);
        return (
          <li
            key={`${g.company}|${g.position}|${i}`}
            data-testid="duplicate-group"
            className="space-y-2 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-medium">{g.position}</span>
                <span className="text-muted-foreground"> · {g.company}</span>
              </div>
              <span className="text-xs text-muted-foreground">{g.jobs.length} job đang mở</span>
            </div>
            <div className="overflow-x-auto">
              <table aria-label={`Job trùng: ${g.position} · ${g.company}`} className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Job
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Nguồn
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Hạn nộp
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {g.jobs.map((j) => (
                    <tr key={j.id} data-job-id={j.id} data-keep={j.id === keep ? "true" : undefined}>
                      <td className="py-2 pr-3">
                        <Link href={`/jobs/${j.id}`} className="underline-offset-2 hover:underline">
                          {j.position}
                        </Link>
                        {j.id === keep ? (
                          <span
                            data-testid="suggest-keep"
                            className="ml-2 rounded-full bg-green-100 px-2 py-[2px] text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200"
                          >
                            Nên giữ
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{j.source}</td>
                      <td className="py-2 pr-3 font-mono">{deadlineLabel(j.deadline)}</td>
                      <td className="py-2 text-right">
                        <CloseJobButton jobId={j.id} jobTitle={j.position} kind="duplicate" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {keep === null ? (
              <p data-testid="no-suggestion" className="text-xs text-muted-foreground">
                Chưa đủ căn cứ để gợi ý nên giữ job nào (cần ít nhất 2 job có hạn nộp khác nhau). Bạn tự xem xét.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
