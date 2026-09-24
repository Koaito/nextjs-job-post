"use client";
// app/(app)/them-moi/add-hub-tabs.tsx
// Tương đương tab-bar JS thuần trong add_hub.html (Flask) — ở đó đổi
// tab là ẩn/hiện .dashboard-tab bằng JS, KHÔNG round-trip. Bên Next.js
// mình vẫn đồng bộ tab đang mở vào ?tab= (để deep-link /them-moi?tab=job
// hoạt động đúng — 2 link "Thêm job mới" ở /jobs/page.tsx trỏ thẳng vào
// đây), nhưng dùng router.replace() (không phải push) để đổi tab không
// tạo thêm history entry mới, giống cách dashboard xử lý ?tab= (Nhóm 3
// của plan) — bấm "Back" của trình duyệt không đi lùi qua từng tab đã
// xem.
//
// Plan (dòng 978) yêu cầu: khi 1 tab submit lỗi validate, trang phải
// giữ ĐÚNG tab đang mở, không nhảy tab khác. Vì mỗi Server Action tự
// quản lý state lỗi/input ngay trong component con của nó (JobForm đã
// làm vậy ở Round 3), <AddHubTabs> chỉ cần đảm bảo việc ĐỔI tab bằng
// tay (bấm nút tab khác) không làm mất gì — vì tab không active vẫn
// mounted (chỉ ẩn bằng CSS, không unmount), state của tab kia không bị
// xoá khi staff bấm qua lại.

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type AddHubTab = "job" | "company" | "contact";

const TABS: { id: AddHubTab; label: string }[] = [
  { id: "job", label: "Job" },
  { id: "company", label: "Công ty" },
  { id: "contact", label: "Người liên hệ" },
];

export function AddHubTabs({
  activeTab,
  jobPanel,
  companyPanel,
  contactPanel,
}: {
  activeTab: AddHubTab;
  jobPanel: ReactNode;
  companyPanel: ReactNode;
  contactPanel: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(tab: AddHubTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/them-moi?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => switchTab(t.id)}
            className={
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
              (activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cả 3 panel đều mounted cùng lúc, chỉ ẩn bằng CSS (hidden) —
          không unmount panel không active, để giữ nguyên state/input
          đã nhập nếu staff bấm qua lại giữa các tab (đúng tinh thần
          "không reset trắng" của plan, dù lý do gốc ở Flask là JS
          ẩn/hiện DOM chứ không phải giữ React state — hiệu ứng cuối
          cùng cho staff là giống nhau: không mất dữ liệu đã gõ). */}
      <div className={activeTab === "job" ? "" : "hidden"}>{jobPanel}</div>
      <div className={activeTab === "company" ? "" : "hidden"}>{companyPanel}</div>
      <div className={activeTab === "contact" ? "" : "hidden"}>{contactPanel}</div>
    </div>
  );
}
