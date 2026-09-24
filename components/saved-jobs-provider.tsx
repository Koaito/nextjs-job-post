"use client";

// components/saved-jobs-provider.tsx
// Thay context_processor inject_saved_job_ids của Flask (plan Phần 2 mục
// 5): app/(app)/layout.tsx (Server Component) fetch danh sách job đã lưu
// ĐÚNG 1 LẦN rồi đưa xuống đây; <JobCard>/<SaveJobButton> đọc qua
// useSavedJobs() thay vì mỗi trang tự gọi listMySavedJobIds() lại.
//
// State nằm ở đây (useState) chứ không nằm trong từng nút, vì cùng 1 job
// có thể hiện ở nhiều nơi cùng lúc (card ở /jobs + aside ở trang chi
// tiết) — bấm lưu ở đâu thì mọi nơi đổi theo ngay, không cần reload.
// Cập nhật LẠC QUAN: SaveJobButton gọi setSaved() trước khi server
// action trả kết quả, và tự setSaved() ngược lại nếu action lỗi.
//
// `initialSavedJobIds` chỉ được đọc ĐÚNG 1 LẦN lúc mount (useState
// initializer) — layout có render lại (vd sau revalidatePath) cũng không
// ghi đè state đang có, tránh nháy về trạng thái cũ giữa lúc đang bấm.

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface SavedJobsContextValue {
  isSaved: (jobId: string) => boolean;
  setSaved: (jobId: string, saved: boolean) => void;
}

const SavedJobsContext = createContext<SavedJobsContextValue | null>(null);

export function SavedJobsProvider({
  initialSavedJobIds,
  children,
}: {
  initialSavedJobIds: string[];
  children: React.ReactNode;
}) {
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialSavedJobIds),
  );

  const isSaved = useCallback((jobId: string) => savedIds.has(jobId), [savedIds]);

  const setSaved = useCallback((jobId: string, saved: boolean) => {
    setSavedIds((prev) => {
      if (prev.has(jobId) === saved) return prev; // không đổi -> không render lại
      const next = new Set(prev);
      if (saved) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isSaved, setSaved }), [isSaved, setSaved]);

  return <SavedJobsContext.Provider value={value}>{children}</SavedJobsContext.Provider>;
}

export function useSavedJobs(): SavedJobsContextValue {
  const ctx = useContext(SavedJobsContext);
  if (!ctx) {
    throw new Error("useSavedJobs phải được dùng bên trong <SavedJobsProvider>.");
  }
  return ctx;
}
