import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hạn chờ phản hồi của lib/api/client.ts (Render free tier ngủ / treo). Mock giống api-client.test.ts.
vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/lib/client-ip-server", () => ({ getClientIpHeaders: vi.fn() }));

import { getSessionToken } from "@/lib/session";
import { getClientIpHeaders } from "@/lib/client-ip-server";
import {
  API_STREAM_TIMEOUT_MS,
  API_TIMEOUT_MS,
  ApiError,
  UPSTREAM_TIMEOUT_CODE,
  callAuthed,
  callAuthedStream,
  callPublic,
} from "@/lib/api/client";

type FetchInit = RequestInit & { headers: Record<string, string> };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("CRAWLER_API_URL", "https://api.test");
  vi.stubEnv("CRAWLER_API_KEY", "k");
  vi.mocked(getSessionToken).mockResolvedValue("tok");
  vi.mocked(getClientIpHeaders).mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

/** fetch KHÔNG BAO GIỜ trả lời, chỉ từ chối khi signal bị huỷ (như fetch thật). */
function hangingFetch() {
  const fn = vi.fn(
    (_url: string, init: FetchInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        const fail = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
        // Như fetch thật: signal đã huỷ từ trước thì từ chối ngay.
        if (signal?.aborted) fail();
        else signal?.addEventListener("abort", fail);
      }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function okFetch(body: unknown = { ok: true }) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Bắt lỗi của promise ngay khi nó xảy ra để khỏi bị coi là "unhandled" khi chạy giả lập thời gian. */
function settle<T>(p: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  return p.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
}

describe("hạn chờ phản hồi", () => {
  it("giá trị mặc định: 60 giây cho JSON, 120 giây cho stream", () => {
    expect(API_TIMEOUT_MS).toBe(60_000);
    expect(API_STREAM_TIMEOUT_MS).toBe(120_000);
  });

  it("backend không trả lời -> ApiError 504 mã upstream_timeout đúng lúc hết hạn, không sớm hơn", async () => {
    hangingFetch();
    let done = false;
    const result = settle(callPublic("/x")).then((r) => {
      done = true;
      return r;
    });

    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS - 1);
    expect(done).toBe(false); // còn 1ms: chưa timeout

    await vi.advanceTimersByTimeAsync(1);
    const { error } = await result;
    expect(error).toBeInstanceOf(ApiError);
    const err = error as ApiError;
    expect(err.status).toBe(504);
    expect(err.errorCode).toBe(UPSTREAM_TIMEOUT_CODE);
    expect(err.message).toMatch(/thử lại/i);
  });

  it("callAuthed cũng có hạn chờ như callPublic", async () => {
    hangingFetch();
    const result = settle(callAuthed("/x"));
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    expect(((await result).error as ApiError).errorCode).toBe(UPSTREAM_TIMEOUT_CODE);
  });

  it("callAuthedStream chờ lâu hơn: không timeout ở 60 giây, timeout ở 120 giây", async () => {
    hangingFetch();
    let done = false;
    const result = settle(callAuthedStream("/file")).then((r) => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(API_STREAM_TIMEOUT_MS - API_TIMEOUT_MS);
    expect(((await result).error as ApiError).errorCode).toBe(UPSTREAM_TIMEOUT_CODE);
  });

  it("`timeoutMs` của từng lời gọi ghi đè mặc định và KHÔNG bị truyền xuống fetch", async () => {
    const fn = hangingFetch();
    const result = settle(callPublic("/x", { timeoutMs: 5_000 }));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(((await result).error as ApiError).errorCode).toBe(UPSTREAM_TIMEOUT_CODE);
    const init = fn.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect("timeoutMs" in init).toBe(false);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("phản hồi kịp hạn -> thành công và không để lại timer nào", async () => {
    okFetch({ a: 1 });
    await expect(callPublic("/x")).resolves.toEqual({ a: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lỗi HTTP kịp hạn vẫn ra ApiError cũ (không bị nhầm thành timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: { error_code: "x", message: "Sai" } }), { status: 400 })),
    );
    const err = (await callPublic("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe("x");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("hạn chờ dừng khi đã có header: không cắt ngang lúc đọc body chậm", async () => {
    const fn = okFetch();
    await callPublic("/x");
    const init = fn.mock.calls[0] as unknown as [string, FetchInit];
    await vi.advanceTimersByTimeAsync(API_STREAM_TIMEOUT_MS * 3);
    expect(init[1].signal?.aborted).toBe(false);
  });

  it("lỗi mạng khác (không phải timeout) giữ nguyên, không bị bọc thành ApiError", async () => {
    const boom = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(boom)));
    await expect(callPublic("/x")).rejects.toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("người gọi tự huỷ (init.signal)", () => {
  it("huỷ giữa chừng -> ném lỗi huỷ gốc, KHÔNG phải timeout, và dọn timer", async () => {
    hangingFetch();
    const caller = new AbortController();
    const result = settle(callPublic("/x", { signal: caller.signal }));
    await vi.advanceTimersByTimeAsync(1_000);
    caller.abort();
    const { error } = await result;
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as { name?: string }).name).toBe("AbortError");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("signal đã huỷ từ trước -> fetch nhận signal đã huỷ và ném lỗi huỷ", async () => {
    hangingFetch();
    const caller = new AbortController();
    caller.abort();
    const { error } = await settle(callPublic("/x", { signal: caller.signal }));
    expect(error).not.toBeInstanceOf(ApiError);
    expect(vi.getTimerCount()).toBe(0);
  });
});
