"use client";
// app/(app)/staff-accounts/staff-accounts-table.tsx
// Bảng + thanh lọc của /staff-accounts — Nhóm 3, Đợt 3.2. Phần 1/4: xem +
// lọc. Phần 3/4: đổi role (Dialog xác nhận). Phần 4/4: khoá/mở tài khoản.
// Cột "Thao tác" CHỈ admin thấy (server action vẫn requireAdmin() lại).
//
// Lọc HOÀN TOÀN client-side (KHÔNG round-trip server khi gõ/đổi filter) —
// đúng ghi chú của plan Nhóm 3 Phần 3 (mục staff-accounts): toàn bộ tài
// khoản backend trả về 1 lần (không phân trang), số lượng luôn nhỏ, nên
// lọc bằng useState + .filter() ngay trên mảng đã có — khớp hành vi
// applyFilters() (JS thuần, show/hide <tr>) ở staff_accounts.html (Flask).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import {
  updateStaffActiveStatusAction,
  updateStaffRoleAction,
} from "@/lib/actions/staff-account-actions";
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
  // Khoá tài khoản CHỜ xác nhận (Flask cũng confirm() khi khoá). Mở lại thì
  // chạy luôn, không confirm — giống Flask (mở lại được, không nguy hiểm).
  const [pendingLock, setPendingLock] = useState<StaffUser | null>(null);
  // ss_user_id đang gọi "Kích hoạt lại" — chống bấm đúp, disable đúng nút đó.
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
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

  async function handleReactivate(u: StaffUser) {
    if (reactivatingId) return;
    setReactivatingId(u.ss_user_id);
    const result = await updateStaffActiveStatusAction(u.ss_user_id, true);
    setReactivatingId(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

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
              {isAdmin && <th className="px-3 py-2 font-medium">Thao tác</th>}
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
                        <Button type="button" variant="ghost" size="sm" disabled>
                          Vô hiệu hoá
                        </Button>
                        <span className="text-xs text-muted-foreground">Tài khoản của bạn</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
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
                        {u.is_active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingLock(u)}
                          >
                            Vô hiệu hoá
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={reactivatingId !== null}
                            onClick={() => handleReactivate(u)}
                          >
                            {reactivatingId === u.ss_user_id ? "Đang xử lý…" : "Kích hoạt lại"}
                          </Button>
                        )}
                      </div>
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

      <NoteConfirmDialog
        open={pendingLock !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLock(null);
        }}
        showNote={false}
        danger
        title="Vô hiệu hoá tài khoản?"
        description={
          pendingLock && (
            <>
              Vô hiệu hoá tài khoản <strong>{pendingLock.full_name}</strong>? Người này sẽ không đăng nhập
              được nữa cho tới khi được kích hoạt lại.
            </>
          )
        }
        confirmLabel="Vô hiệu hoá"
        onConfirm={async () => {
          if (!pendingLock) return { ok: false, message: "Không có thay đổi để lưu." };
          const result = await updateStaffActiveStatusAction(pendingLock.ss_user_id, false);
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
