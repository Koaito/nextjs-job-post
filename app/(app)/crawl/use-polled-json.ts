"use client";
// app/(app)/crawl/use-polled-json.ts
// Hook polling DÙNG CHUNG cho mọi khối "live" của /crawl (widget Đang chạy, log live, tiến độ batch...).
//
// Quy tắc (plan 4.3 + bài học bản Flask):
//   - Chỉ poll khi tab trình duyệt đang HIỆN (refreshWhenHidden:false); quay lại thì revalidateOnFocus gọi ngay.
//   - `url = null` tắt hẳn mọi request (SWR huỷ cả revalidate khi focus) — nơi dùng truyền null khi không cần.
//   - Khối nằm trong tab nào thì chỉ tồn tại khi tab đó được dựng (server chỉ dựng tab đang mở, đổi tab là điều
//     hướng thật), nên unmount = dừng poll. Hook KHÔNG tự lo việc "tab ẩn bằng CSS" vì app không làm vậy.
//   - 401 -> dừng HẲN (không retry), xử lý "phiên kết thúc" nếu error_code thuộc nhóm đó (Phụ lục C); 403 cũng dừng.
//   - Lỗi khác (429, 5xx, mạng): giãn dần gấp đôi, trần maxMs; thành công một lần là về lại chu kỳ gốc.

import { useState } from "react";
import useSWR from "swr";
import { isTerminalPollError, pollBackoffDelay, PollHttpError } from "@/lib/data-ops/poll";
import { endSessionIfNeeded, readErrorCode } from "@/lib/session-end-client";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new PollHttpError(res.status, await readErrorCode(res));
  return (await res.json()) as T;
}

export interface PolledJson<T> {
  data: T | undefined;
  /** Lỗi gần nhất (đã hết quyền/hết phiên thì còn mãi cho tới khi remount). */
  error: unknown;
  /** True khi đã dừng hẳn vì 401/403: UI nên hiện thông báo, không còn tự cập nhật. */
  stopped: boolean;
  /** Gọi lại ngay (vd sau khi vừa bấm chạy một lượt mới). */
  refresh: () => void;
}

export function usePolledJson<T>(
  url: string | null,
  opts: {
    /** Chu kỳ poll (ms). Dạng hàm nhận dữ liệu mới nhất: trả 0 để DỪNG poll (vd run đã xong). */
    intervalMs: number | ((latest: T | undefined) => number);
    maxBackoffMs?: number;
  },
): PolledJson<T> {
  const [stopped, setStopped] = useState(false);
  const maxMs = opts.maxBackoffMs ?? 45_000;
  // Cơ sở cho giãn dần khi lỗi: nếu chu kỳ là hàm (có thể trả 0) thì lấy 3 giây, không dùng 0.
  const baseMs = typeof opts.intervalMs === "number" && opts.intervalMs > 0 ? opts.intervalMs : 3_000;

  const { data, error, mutate } = useSWR<T>(stopped ? null : url, fetchJson<T>, {
    refreshInterval: opts.intervalMs,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    // Dữ liệu cũ vẫn hiện trong lúc lỗi tạm thời; ca có dữ liệu thật mới rơi xuống lỗi.
    shouldRetryOnError: true,
    onError: (err) => {
      if (!isTerminalPollError(err)) return;
      setStopped(true);
      if (err instanceof PollHttpError) endSessionIfNeeded(err.status, err.errorCode);
    },
    onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
      if (isTerminalPollError(err)) return;
      setTimeout(() => revalidate({ retryCount }), pollBackoffDelay(baseMs, retryCount, maxMs));
    },
  });

  return { data, error, stopped, refresh: () => void mutate() };
}
