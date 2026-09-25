"use client";
// app/(app)/companies/potential-cell.tsx
// Sửa nhanh "Tiềm năng" NGAY TẠI BẢNG /companies — khớp <details class=
// "potential-edit"> trong companies.html bên Flask: bấm vào chip mở
// popover đổi mức, note KHÔNG bắt buộc (khác đổi trạng thái contact —
// Phần 2, backend chặn cứng phải có note). Dùng <details>/<summary> gốc
// (không phải Dialog) để khớp đúng UX cũ: mở tại chỗ ngay dưới chip,
// không che khuất cả màn hình.

import { useRef, useState } from "react";
import { PARTNERSHIP_POTENTIAL_CODES, PARTNERSHIP_POTENTIAL_LABELS } from "@/lib/constants";
import type { PotentialSuggestion } from "@/lib/company-potential";
import { updateCompanyPotentialAction } from "@/lib/actions/company-actions";

const CHIP_STYLES: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-muted text-muted-foreground",
  UNVERIFIED: "bg-muted text-muted-foreground",
};

export function PotentialCell({
  companyId,
  potential,
  suggestion,
}: {
  companyId: string;
  potential: string;
  suggestion: PotentialSuggestion;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [value, setValue] = useState(potential);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateCompanyPotentialAction(companyId, value, note);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote("");
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleCancel() {
    setValue(potential);
    setNote("");
    setError(null);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details ref={detailsRef} className="relative inline-block">
      <summary className="cursor-pointer list-none">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_STYLES[potential] ?? CHIP_STYLES.UNVERIFIED}`}
        >
          {PARTNERSHIP_POTENTIAL_LABELS[potential] ?? potential}
        </span>
      </summary>

      <div className="absolute left-0 top-full z-20 mt-2 w-72 space-y-2 rounded-md border bg-popover p-3 text-sm shadow-md">
        <div>
          <p className="mb-1 text-xs font-semibold">
            🤖 Gợi ý: {PARTNERSHIP_POTENTIAL_LABELS[suggestion.level]} ({suggestion.score}/{suggestion.maxScore} tiêu
            chí)
          </p>
          <ul className="space-y-0.5 text-xs">
            {suggestion.criteria.map((c) => (
              <li key={c.label} className={c.met ? "text-emerald-700" : "text-muted-foreground"}>
                <span className="mr-1">{c.met ? "✓" : "✗"}</span>
                {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Chỉ là gợi ý tự động — không phải đánh giá đã chốt.</p>
        </div>

        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {PARTNERSHIP_POTENTIAL_CODES.map((code) => (
            <option key={code} value={code}>
              {PARTNERSHIP_POTENTIAL_LABELS[code]}
            </option>
          ))}
        </select>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          rows={2}
          placeholder="Lý do đổi tiềm năng — không bắt buộc…"
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleCancel} disabled={pending} className="text-xs text-muted-foreground underline">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </details>
  );
}
