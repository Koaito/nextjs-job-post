import { describe, expect, it, vi } from "vitest";

const endSessionIfNeeded = vi.fn();
vi.mock("@/lib/session-end-client", () => ({ endSessionIfNeeded: (...a: unknown[]) => endSessionIfNeeded(...a) }));

import { CrawlClientError, startCrawlBatch } from "@/lib/data-ops/crawl-client";

const json = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

const REQ = { source: "topcv", categories: ["data-analyst"] };

describe("startCrawlBatch", () => {
  it("thành công trả batchId/firstRunId và gửi đúng POST JSON", async () => {
    const fetcher = vi.fn(json(202, { ok: true, batchId: "b", firstRunId: "r" })) as unknown as typeof fetch;
    expect(await startCrawlBatch(REQ, fetcher)).toEqual({ batchId: "b", firstRunId: "r" });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/crawl/batch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(REQ);
  });
  it("409 -> CrawlClientError với message tiếng Việt, kèm status và code", async () => {
    const err = await startCrawlBatch(REQ, json(409, { ok: false, message: "x", errorCode: "crawl_already_active" })).catch((e) => e);
    expect(err).toBeInstanceOf(CrawlClientError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("crawl_already_active");
    expect(err.message).toMatch(/chạy dở/);
  });
  it("429 và 403 rẽ nhánh theo status", async () => {
    expect((await startCrawlBatch(REQ, json(429, { ok: false })).catch((e) => e)).message).toMatch(/10 lượt/);
    expect((await startCrawlBatch(REQ, json(403, { ok: false })).catch((e) => e)).message).toMatch(/admin/);
  });
  it("body không phải JSON (HTML 502 của nền tảng) vẫn ra thông báo đúng theo status", async () => {
    const html = (async () => new Response("<html>Bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
    const err = await startCrawlBatch(REQ, html).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/sự cố/);
  });
  it("lỗi mạng -> status 0", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await startCrawlBatch(REQ, down).catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/kết nối/);
  });
  it("401 báo cho cơ chế phiên kết thúc kèm error_code", async () => {
    endSessionIfNeeded.mockClear();
    await startCrawlBatch(REQ, json(401, { ok: false, errorCode: "session_replaced" })).catch(() => undefined);
    expect(endSessionIfNeeded).toHaveBeenCalledWith(401, "session_replaced");
  });
  it("200 nhưng thiếu batchId -> coi là lỗi, không trả kết quả rỗng", async () => {
    await expect(startCrawlBatch(REQ, json(200, { ok: true }))).rejects.toBeInstanceOf(CrawlClientError);
  });
});
