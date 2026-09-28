// app/(app)/contacts/layout.tsx
// Layout chung của /contacts và /contacts/email-templates — chỉ
// chứa tab-nav; mỗi page tự render header (tiêu đề/mô tả khác nhau theo
// tab, và nút "＋ Thêm người liên hệ" chỉ có ở tab danh sách, giống
// contacts.html). Khác Flask ở thứ tự: tab-nav nằm TRÊN header vì layout
// không biết page con nào đang render.
//
// Không cache giữa các lần chuyển tab/lọc (plan Nhóm 2, giống
// activity_logs): các page con đặt `dynamic = "force-dynamic"`.

import { ContactsTabNav } from "./contacts-tab-nav";

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ContactsTabNav />
      {children}
    </div>
  );
}
