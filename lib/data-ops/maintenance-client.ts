// lib/data-ops/maintenance-client.ts
// Lời gọi POST /api/maintenance/{jobType} từ TRÌNH DUYỆT (Client Component). Ném MaintenanceClientError với message
// tiếng Việt đã sẵn để hiện; body lỗi không phải JSON (HTML của nền tảng) vẫn ra đúng thông báo theo status.

import type { MaintenanceJobType, MaintenanceRunRequest } from "@/lib/data-ops/maintenance";
import { maintenanceTriggerErrorMessage } from "@/lib/data-ops/maintenance-form";
import { endSessionIfNeeded } from "@/lib/session-end-client";

export class MaintenanceClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "MaintenanceClientError";
  }
}

export interface MaintenanceStarted {
  runId: string;
  jobType: string;
}

interface OkBody {
  ok: true;
  runId: string;
  jobType: string;
}
interface ErrBody {
  ok: false;
  message?: string;
  errorCode?: string;
}

export async function startMaintenanceRun(
  jobType: MaintenanceJobType,
  req: MaintenanceRunRequest,
  fetcher: typeof fetch = fetch,
): Promise<MaintenanceStarted> {
  let res: Response;
  try {
    res = await fetcher(`/api/maintenance/${encodeURIComponent(jobType)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      cache: "no-store",
    });
  } catch {
    throw new MaintenanceClientError(maintenanceTriggerErrorMessage(0), 0);
  }
  const body = (await res.json().catch(() => null)) as OkBody | ErrBody | null;
  if (res.ok && body && body.ok === true && typeof body.runId === "string" && typeof body.jobType === "string") {
    return { runId: body.runId, jobType: body.jobType };
  }
  const code = body && body.ok === false ? body.errorCode : undefined;
  const fallback = body && body.ok === false ? body.message : undefined;
  endSessionIfNeeded(res.status, code);
  throw new MaintenanceClientError(maintenanceTriggerErrorMessage(res.status, code, fallback), res.status, code);
}
