// app/(app)/dashboard/pct-badge.tsx
// Huy hiệu "+12%" / "-5%" / "0%" cạnh số liệu tháng này — tương đương
// .pct-badge + .pct-up/.pct-down/.pct-flat (08-dashboard.css, Flask). Thuần
// hiển thị, không "use client" để dùng được ở Server Component.
//
// pct = null/undefined (tháng trước = 0, backend không chia được) -> KHÔNG
// render gì, đúng như {% if pct is not none %} bên Flask. Tuyệt đối không coi
// null là 0: "0%" nghĩa là đi ngang, còn null nghĩa là không có gì để so.

import { cn } from "@/lib/utils";
import { formatPct, pctTone, type PctTone } from "@/lib/dashboard/monthly";

const TONE_CLASS: Record<PctTone, string> = {
  up: "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]",
  down: "bg-[#F1EDF0] text-[#8A6E80]",
  flat: "bg-[#EDEFEC] text-muted-foreground",
};

export function PctBadge({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (pct === null || pct === undefined) return null;
  return (
    <span
      title="So với tháng trước"
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-[7px] py-px font-mono text-[11.5px] font-semibold",
        TONE_CLASS[pctTone(pct)],
        className,
      )}
    >
      {formatPct(pct)}
    </span>
  );
}
