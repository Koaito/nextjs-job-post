// lib/data-ops/crawl-client.ts
// Lời gọi POST /api/crawl/batch từ TRÌNH DUYỆT (Client Component). Ném CrawlClientError với message tiếng Việt đã
// sẵn để hiện; body lỗi không phải JSON (HTML của nền tảng) vẫn ra đúng thông báo theo status.

import type { CrawlBatchRequest } from "@/lib/data-ops/crawl";
import { crawlTriggerErrorMessage } from "@/lib/data-ops/crawl-form";
import { endSessionIfNeeded } from "@/lib/session-end-client";

export class CrawlClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "CrawlClientError";
  }
}

export interface CrawlBatchStarted {
  batchId: string;
  firstRunId: string;
}

interface OkBody {
  ok: true;
  batchId: string;
  firstRunId: string;
}
interface ErrBody {
  ok: false;
  message?: string;
  errorCode?: string;
}

export async function startCrawlBatch(
  req: CrawlBatchRequest,
  fetcher: typeof fetch = fetch,
): Promise<CrawlBatchStarted> {
  let res: Response;
  try {
    res = await fetcher("/api/crawl/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      cache: "no-store",
    });
  } catch {
    throw new CrawlClientError(crawlTriggerErrorMessage(0), 0);
  }
  const body = (await res.json().catch(() => null)) as OkBody | ErrBody | null;
  if (res.ok && body && body.ok === true && typeof body.batchId === "string" && typeof body.firstRunId === "string") {
    return { batchId: body.batchId, firstRunId: body.firstRunId };
  }
  const code = body && body.ok === false ? body.errorCode : undefined;
  const fallback = body && body.ok === false ? body.message : undefined;
  endSessionIfNeeded(res.status, code);
  throw new CrawlClientError(crawlTriggerErrorMessage(res.status, code, fallback), res.status, code);
}
