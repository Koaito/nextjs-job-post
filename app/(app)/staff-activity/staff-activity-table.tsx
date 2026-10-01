"use client";
// app/(app)/staff-activity/staff-activity-table.tsx
// Bảng + ô tìm của /staff-activity — Nhóm 3, Đợt 3.3, Phần 2/4.
//
// Lọc HOÀN TOÀN client-side (không round-trip khi gõ): toàn bộ nhân sự
// trả về 1 lần, không phân trang — khớp script show/hide <tr> ở
// staff_activity.html (Flask), đúng plan Nhóm 3.
//
// Dòng của CHÍNH MÌNH: hiện badge "Bạn" và link trỏ /profile/activity
// (không trỏ /staff-activity/[id]) — khớp Flask; trang [id] cũng tự chặn
// ở phía server, đây chỉ là phần link cho khỏi bấm vào rồi mới bị đẩy đi.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateVN } from "@/lib/date";
import type { StaffUser } from "@/lib/api/auth";

export function StaffActivityTable({
  staff,
  currentUserId,
}: {
  staff: StaffUser[];
  /** ss_user_id của người đang đăng nhập. */
  currentUserId: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter(
      (s) => s.full_name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle),
    );
  }, [staff, q]);

  if (staff.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        Chưa có thành viên team SS nào, hoặc không tải được danh sách (xem thông báo lỗi phía trên nếu có).
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
        Hiển thị {filtered.length} / {staff.length} thành viên
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Họ tên</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Vai trò</th>
              <th className="px-3 py-2 font-medium">Ngày tạo tài khoản</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isMe = s.ss_user_id === currentUserId;
              return (
                <tr key={s.ss_user_id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {s.full_name}
                    {isMe && (
                      <span className="ml-2 inline-block rounded-full bg-[var(--brand-teal-soft)] px-2 py-[2px] text-xs font-semibold text-[var(--brand-teal)]">
                        Bạn
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-xs">
                      {ROLE_LABELS[s.role] ?? s.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateVN(s.created_at)}</td>
                  <td className="px-3 py-2">
                    {isMe ? (
                      <Link href="/profile/activity" className="text-sm underline">
                        Xem tại Trang cá nhân →
                      </Link>
                    ) : (
                      <Link href={`/staff-activity/${s.ss_user_id}`} className="text-sm underline">
                        Xem hoạt động →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
