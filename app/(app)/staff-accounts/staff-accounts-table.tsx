"use client";
// app/(app)/staff-accounts/staff-accounts-table.tsx
// Bảng + thanh lọc của /staff-accounts — Nhóm 3, Đợt 3.2. Phần 1/4: xem +
// lọc. Phần 3/4: cột "Đổi role" (CHỈ admin thấy, kèm Dialog xác nhận).
// Khoá/mở tài khoản là phần 4/4, sẽ thêm vào cùng cột này.
//
// Lọc HOÀN TOÀN client-side (KHÔNG round-trip server khi gõ/đổi filter) —
// đúng ghi chú của plan Nhóm 3 Phần 3 (mục staff-accounts): toàn bộ tài
// khoản backend trả về 1 lần (không phân trang), số lượng luôn nhỏ, nên
// lọc bằng useState + .filter() ngay trên mảng đã có — khớp hành vi
// applyFilters() (JS thuần, show/hide <tr>) ở staff_accounts.html (Flask).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { updateStaffRoleAction } from "@/lib/actions/staff-account-actions";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTimeVN } from "@/lib/date";
import type { StaffUser } from "@/lib/api/auth";

const ROLES = Object.keys(ROLE_LABELS);

type StatusFilter = "" | "active" | "inactive";

function isStatusFilter(value: string): value is StatusFilter {
  return value === "" || value === "active" || value === "inactive";
}

export function StaffAccountsTable({
  users,
  isAdmin,
  currentUserId,
}: {
  users: StaffUser[];
  /** Chỉ admin thấy cột "Đổi role" (server đã check lại ở action, đây chỉ là UI). */
  isAdmin: boolean;
  /** ss_user_id của admin đang đăng nhập — dòng này bị disable (plan Nhóm 3). */
  currentUserId: string;
}) {
  const router = useRouter();
  // Đổi role CHỜ xác nhận: select vẫn hiện role hiện tại (controlled bởi
  // u.role) nên bấm Hủy tự động "trả lại" lựa chọn cũ, không cần reset tay.
  const [pendingRole, setPendingRole] = useState<{ user: StaffUser; newRole: string } | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ =
        !needle || u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle);
      const matchesRole = !role || u.role === role;
      const matchesStatus = !status || (status === "active" ? u.is_active : !u.is_active);
      return matchesQ && matchesRole && matchesStatus;
    });
  }, [users, q, role, status]);

  if (users.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        Không tải được danh sách tài khoản (xem thông báo lỗi phía trên nếu có).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo họ tên, email…"
          className="w-64 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Tất cả role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            if (isStatusFilter(e.target.value)) setStatus(e.target.value);
          }}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã vô hiệu hoá</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {users.length} tài khoản
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Họ tên</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Lần đăng nhập gần nhất</th>
              {isAdmin && <th className="px-3 py-2 font-medium">Đổi role</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.ss_user_id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{u.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-xs">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  {u.must_change_password && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(chưa đổi mật khẩu tạm)</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.is_active ? "Đang hoạt động" : "Đã vô hiệu hoá"}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.last_login_at ? formatDateTimeVN(u.last_login_at) : "Chưa từng đăng nhập"}</td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    {u.ss_user_id === currentUserId ? (
                      <div className="flex items-center gap-2">
                        <select
                          disabled
                          value={u.role}
                          aria-label={`Đổi role của ${u.full_name}`}
                          className="rounded-md border bg-background px-2 py-1 text-sm"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-muted-foreground">Tài khoản của bạn</span>
                      </div>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => setPendingRole({ user: u, newRole: e.target.value })}
                        aria-label={`Đổi role của ${u.full_name}`}
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">Không có tài khoản nào khớp bộ lọc.</p>
        )}
      </div>

      <NoteConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
        showNote={false}
        title="Đổi role tài khoản?"
        description={
          pendingRole && (
            <>
              Đổi role của <strong>{pendingRole.user.full_name}</strong> từ{" "}
              <strong>{ROLE_LABELS[pendingRole.user.role] ?? pendingRole.user.role}</strong> →{" "}
              <strong>{ROLE_LABELS[pendingRole.newRole] ?? pendingRole.newRole}</strong>? Quyền hạn của tài
              khoản này thay đổi ngay.
            </>
          )
        }
        confirmLabel="Đổi role"
        onConfirm={async () => {
          if (!pendingRole) return { ok: false, message: "Không có thay đổi để lưu." };
          const result = await updateStaffRoleAction(pendingRole.user.ss_user_id, pendingRole.newRole);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          }
          return result;
        }}
      />
    </div>
  );
}
