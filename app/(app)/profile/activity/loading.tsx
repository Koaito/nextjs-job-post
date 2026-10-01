// app/(app)/profile/activity/loading.tsx
// Khung chờ cho /profile/activity (Nhóm 5, Đợt 5.4). Khung "Trang cá nhân" +
// sub-nav nằm ở profile/layout.tsx nên vẫn hiện nguyên, loading.tsx này chỉ
// thay phần thân. Tiêu đề + mô tả là chữ tĩnh nên hiện thật, không skeleton.

import { StaffActivitySkeleton } from "@/components/staff-activity-skeleton";

export default function ProfileActivityLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Hoạt động của bạn</h2>
        <p className="text-muted-foreground">
          Job/công ty/contact bạn đã tự thêm tay, và contact đang được giao cho bạn phụ trách.
        </p>
      </div>

      <StaffActivitySkeleton />
    </div>
  );
}
