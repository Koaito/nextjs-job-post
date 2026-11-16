"use client";
// app/(app)/data-management/data-management-tabs.tsx
// Tab Xuất dữ liệu <-> Nhập dữ liệu trong CÙNG một entity: thuần client (state), không điều hướng.
// Cả hai panel dựng ngay nhưng chỉ panel đang chọn hiện ra (hidden), để chuyển tab không làm mất
// kết quả xem trước / bộ lọc đang nhập.
//
// Phần 2/3 sẽ thay khung "sắp có" bên dưới bằng panel Nhập dữ liệu thật.

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DataEntityType } from "@/lib/data-ops/export-filters";
import { DATA_ENTITY_LABELS } from "@/lib/data-ops/export-ui";
import { ExportPanel } from "./export-panel";

type TabId = "export" | "import";

const TABS: { id: TabId; label: string }[] = [
  { id: "export", label: "Xuất dữ liệu" },
  { id: "import", label: "Nhập dữ liệu" },
];

export function DataManagementTabs({ entity }: { entity: DataEntityType }) {
  const [tab, setTab] = useState<TabId>("export");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Xuất hoặc nhập dữ liệu" className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              id={`dm-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`dm-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div id="dm-panel-export" role="tabpanel" aria-labelledby="dm-tab-export" hidden={tab !== "export"}>
        <ExportPanel entity={entity} />
      </div>

      <div id="dm-panel-import" role="tabpanel" aria-labelledby="dm-tab-import" hidden={tab !== "import"}>
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          Nhập {DATA_ENTITY_LABELS[entity]} từ file CSV/XLSX sẽ có ở bản cập nhật tiếp theo (phần 2/3 của
          nhóm 6).
        </p>
      </div>
    </div>
  );
}
