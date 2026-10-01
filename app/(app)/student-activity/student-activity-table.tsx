"use client";
// app/(app)/student-activity/student-activity-table.tsx
// Bảng + ô tìm của /student-activity — Nhóm 3, Đợt 3.3, Phần 3/4.
// Lọc HOÀN TOÀN client-side theo họ tên/email (không round-trip), không
// phân trang — khớp script show/hide <tr> ở student_activity.html (Flask).

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateVN } from "@/lib/date";
import type { StaffUser } from "@/lib/api/auth";

export function StudentActivityTable({ students }: { students: StaffUser[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle),
    );
  }, [students, q]);

  if (students.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        Chưa có học viên nào đăng ký, hoặc không tải được danh sách (xem thông báo lỗi phía trên nếu có).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo họ tên, email…"
        className="w-64 rounded-md border bg-background px-3 py-1.5 text-sm"
      />

      <p className="text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {students.length} học viên
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Họ tên</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Điện thoại</th>
              <th className="px-3 py-2 font-medium">Ngày đăng ký</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.ss_user_id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{s.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.phone || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDateVN(s.created_at)}</td>
                <td className="px-3 py-2">
                  <Link href={`/student-activity/${s.ss_user_id}`} className="text-sm underline">
                    Xem hoạt động →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
