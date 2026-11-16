// app/(app)/data-management/entity-nav.tsx
// Chọn loại dữ liệu (Job / Công ty / Contact). Là <Link> THẬT tới ?entity=... (đổi entity là điều
// hướng, không phải state client) nên làm được nút Back, copy link, và form bên dưới tự reset.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { DATA_ENTITY_TYPES, type DataEntityType } from "@/lib/data-ops/export-filters";
import { DATA_ENTITY_LABELS } from "@/lib/data-ops/export-ui";

export function DataManagementEntityNav({ entity }: { entity: DataEntityType }) {
  return (
    <nav aria-label="Loại dữ liệu" className="flex flex-wrap gap-2">
      {DATA_ENTITY_TYPES.map((type) => {
        const active = type === entity;
        return (
          <Link
            key={type}
            href={`/data-management?entity=${type}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium",
              active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {DATA_ENTITY_LABELS[type]}
          </Link>
        );
      })}
    </nav>
  );
}
