// app/(app)/crawl/health-rows-table.tsx
// Bảng "thiếu field" dùng chung cho Job (tổng và từng nguồn) và Company. Server Component thuần.

import { missingSummary } from "@/lib/data-ops/data-health";

export interface HealthRowView {
  field: string;
  label: string;
  missing: number;
  total: number;
  pct_missing: number;
}

export function HealthRowsTable({ rows, caption }: { rows: HealthRowView[]; caption: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có số liệu.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table aria-label={caption} className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Trường
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Thiếu
            </th>
            <th scope="col" className="w-40 px-3 py-2 font-medium">
              Tỷ lệ thiếu
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.field}>
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2 font-mono">{missingSummary(r)}</td>
              <td className="px-3 py-2">
                <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${Math.min(100, Math.max(0, r.pct_missing))}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
