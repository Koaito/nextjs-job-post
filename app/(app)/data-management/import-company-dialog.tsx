"use client";
// app/(app)/data-management/import-company-dialog.tsx
// Hộp chọn công ty cho dòng pending_company_resolution (chỉ Job/Contact). Hai luồng khác hẳn nhau ở
// backend: "Tạo công ty mới" (company_id null) hoặc chọn một công ty gợi ý (UUID thật, backend dò trùng
// lại với tên công ty thật). Độ khớp là `similarity` (0-1). Gợi ý lấy lại cho ĐÚNG dòng này mỗi lần mở.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DataEntityType } from "@/lib/data-ops/export-filters";
import {
  IMPORT_NEW_COMPANY_ID,
  type ImportCompanySuggestion,
  type ImportPreviewRow,
} from "@/lib/data-ops/import";
import { fetchCompanySuggestions } from "@/lib/data-ops/import-client";
import { companyChoiceToId } from "@/lib/data-ops/import-review";
import { formatImportCell, formatSimilarity } from "@/lib/data-ops/import-ui";

export function ImportCompanyDialog({
  open,
  onOpenChange,
  entity,
  previewId,
  row,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: DataEntityType;
  previewId: string;
  row: ImportPreviewRow;
  /** Gọi backend resolve-company; ném lỗi (ImportClientError) để hộp hiện tại chỗ. */
  onChoose: (companyId: string | null) => Promise<void>;
}) {
  const [suggestions, setSuggestions] = useState<ImportCompanySuggestion[]>(
    row.company_resolution?.suggestions ?? [],
  );
  const [choice, setChoice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const companyName = formatImportCell(row.data.company_name);

  useEffect(() => {
    // Hộp chỉ được dựng khi mở (mỗi lần mở là một lần mount mới) nên state đã sạch, không cần reset.
    let cancelled = false;
    fetchCompanySuggestions(entity, previewId, row.row_index)
      .then((list) => {
        if (!cancelled) setSuggestions(list);
      })
      .catch(() => {
        /* giữ gợi ý đang có trong dòng; lỗi thật sẽ hiện khi bấm xác nhận */
      });
    return () => {
      cancelled = true;
    };
  }, [entity, previewId, row.row_index]);

  async function submit() {
    if (!choice) return;
    setPending(true);
    setError(null);
    try {
      await onChoose(companyChoiceToId(choice));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chọn được công ty.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chọn công ty cho dòng {row.row_index + 2}</DialogTitle>
          <DialogDescription>
            Tên trong file: <strong>{companyName || "(trống)"}</strong>. Không có công ty trùng khớp hoàn
            toàn, hãy chọn công ty đã có hoặc tạo mới.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" data-testid="company-choices">
          <legend className="sr-only">Công ty</legend>
          {suggestions.map((s) => (
            <label key={s.company_id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
              <input
                type="radio"
                name="company-choice"
                value={s.company_id}
                checked={choice === s.company_id}
                onChange={() => setChoice(s.company_id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{s.company_name}</span>
                {!s.is_active && <span className="ml-2 text-xs text-amber-600">đã ngừng hoạt động</span>}
                <span className="block text-xs text-muted-foreground">
                  {s.tax_id ? `MST ${s.tax_id} · ` : ""}độ khớp {formatSimilarity(s.similarity)}
                </span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
            <input
              type="radio"
              name="company-choice"
              value={IMPORT_NEW_COMPANY_ID}
              checked={choice === IMPORT_NEW_COMPANY_ID}
              onChange={() => setChoice(IMPORT_NEW_COMPANY_ID)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Tạo công ty mới</span>
              <span className="block text-xs text-muted-foreground">Theo tên “{companyName}” trong file.</span>
            </span>
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button type="button" onClick={submit} disabled={!choice || pending}>
            {pending ? "Đang xử lý…" : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
