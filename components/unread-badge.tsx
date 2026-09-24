"use client";

// components/unread-badge.tsx
// Badge số tin nhắn chưa đọc trên sidebar — thay initUnreadBadgePolling()
// + createPoller() trong app.js (plan Phần 2 mục 5 + Phần 3 mục 2).
//
// 3 quy tắc của createPoller() bản Flask, map sang SWR:
//   - Poll mỗi 20s (BADGE_BASE_INTERVAL)           -> refreshInterval
//   - Lỗi liên tiếp: giãn gấp đôi, trần 45s        -> onErrorRetry
//     (20s -> 40s -> 45s -> 45s...), thành công 1 lần là về lại 20s
//     (SWR tự dùng lại refreshInterval sau lần revalidate thành công)
//   - Nhận 401 thì dừng HẲN, không retry nữa       -> setStopped(true) +
//     key = null (SWR huỷ hẳn mọi revalidate, kể cả khi focus lại tab)
//   - Chỉ poll khi tab đang hiện: refreshWhenHidden mặc định false; khi
//     quay lại tab, revalidateOnFocus gọi lại ngay (giống visibilitychange
//     -> tick() bên Flask).
//
// Component này phải là anh em của <SidebarMenuButton> bên trong cùng
// <SidebarMenuItem> (SidebarMenuBadge định vị tuyệt đối theo <li>).

import { useState } from "react";
import useSWR from "swr";
import { SidebarMenuBadge } from "@/components/ui/sidebar";

const ENDPOINT = "/api/messages/unread-count";
const BASE_INTERVAL_MS = 20_000; // khớp BADGE_BASE_INTERVAL
const MAX_INTERVAL_MS = 45_000; // khớp BADGE_MAX_INTERVAL

class UnreadFetchError extends Error {
  constructor(public readonly status: number) {
    super(`unread-count request failed: ${status}`);
    this.name = "UnreadFetchError";
  }
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof UnreadFetchError && err.status === 401;
}

async function fetchUnreadCount(url: string): Promise<{ count: number }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new UnreadFetchError(res.status);
  return res.json();
}

export function UnreadBadge() {
  const [stopped, setStopped] = useState(false);

  const { data } = useSWR<{ count: number }>(stopped ? null : ENDPOINT, fetchUnreadCount, {
    refreshInterval: BASE_INTERVAL_MS,
    refreshWhenHidden: false,
    onError: (err) => {
      if (isUnauthorized(err)) setStopped(true);
    },
    onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
      if (isUnauthorized(err)) return; // dừng hẳn
      // retryCount bắt đầu từ 1 ở lần retry đầu -> 40s, rồi chạm trần 45s.
      const delay = Math.min(BASE_INTERVAL_MS * 2 ** retryCount, MAX_INTERVAL_MS);
      setTimeout(() => revalidate({ retryCount }), delay);
    },
  });

  const count = data?.count ?? 0;
  if (count <= 0) return null; // khớp `hidden` khi count = 0 bên Flask

  return (
    <SidebarMenuBadge
      className="bg-sidebar-primary"
      aria-label={`${count} tin nhắn chưa đọc`}
    >
      {count > 99 ? "99+" : count}
    </SidebarMenuBadge>
  );
}
