import { beforeEach, describe, expect, it, vi } from "vitest";

// Hai Route Handler của Xuất dữ liệu: mock tầng gọi mạng + guard, kiểm quyền, kiểm tra tham số,
// và (quan trọng) tải file phải forward body theo stream cùng Content-Disposition của backend.
const getCurrentUser = vi.fn();
const getExportPreview = vi.fn();
const downloadExport = vi.fn();
const requireStaff = vi.fn();

vi.mock("@/lib/session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/auth-guard", () => ({ requireStaff: () => requireStaff() }));
vi.mock("@/lib/api/import-export", () => ({
  getExportPreview: (...a: unknown[]) => getExportPreview(...a),
  downloadExport: (...a: unknown[]) => downloadExport(...a),
}));

import { ApiError } from "@/lib/api/client";
import { GET as previewGET } from "@/app/api/export/[entity]/preview/route";
import { GET as downloadGET } from "@/app/(app)/data-management/export/[entity]/route";

const ctx = (entity: string) => ({ params: Promise.resolve({ entity }) });
const req = (path: string) => new Request(`http://localhost${path}`);

beforeEach(() => {
  getCurrentUser.mockReset();
  getExportPreview.mockReset();
  downloadExport.mockReset();
  requireStaff.mockReset();
});

describe("GET /api/export/[entity]/preview", () => {
  it("chưa đăng nhập -> 401, học viên -> 403, đều no-store và không gọi backend", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const r1 = await previewGET(req("/api/export/job/preview"), ctx("job"));
    expect(r1.status).toBe(401);
    expect(r1.headers.get("Cache-Control")).toBe("no-store");

    getCurrentUser.mockResolvedValueOnce({ is_staff: false });
    const r2 = await previewGET(req("/api/export/job/preview"), ctx("job"));
    expect(r2.status).toBe(403);
    expect(getExportPreview).not.toHaveBeenCalled();
  });

  it("entity lạ -> 404; bộ lọc sai kiểu/sai entity -> 400 và không gọi backend", async () => {
    getCurrentUser.mockResolvedValue({ is_staff: true });
    expect((await previewGET(req("/api/export/user/preview"), ctx("user"))).status).toBe(404);
    expect((await previewGET(req("/api/export/job/preview?is_active=abc"), ctx("job"))).status).toBe(400);
    // Job không có is_active -> chặn sớm thay vì để backend trả 400
    expect((await previewGET(req("/api/export/job/preview?is_active=true"), ctx("job"))).status).toBe(400);
    expect((await previewGET(req("/api/export/company/preview?status=OPEN"), ctx("company"))).status).toBe(400);
    expect(getExportPreview).not.toHaveBeenCalled();
  });

  it("hợp lệ -> gọi backend với bộ lọc đã parse và trả ok + preview", async () => {
    getCurrentUser.mockResolvedValue({ is_staff: true });
    getExportPreview.mockResolvedValue({ entity_type: "job", total_matching: 3, will_export: 3, columns: ["a"] });
    const res = await previewGET(req("/api/export/job/preview?status=OPEN&limit=5"), ctx("job"));
    expect(res.status).toBe(200);
    expect(getExportPreview).toHaveBeenCalledWith("job", { status: "OPEN", limit: 5 });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.preview.total_matching).toBe(3);
  });

  it("lỗi backend giữ status, 429 có message tiếng Việt; lỗi mạng -> 502", async () => {
    getCurrentUser.mockResolvedValue({ is_staff: true });
    getExportPreview.mockRejectedValueOnce(new ApiError("Too many", 429));
    const r1 = await previewGET(req("/api/export/job/preview"), ctx("job"));
    expect(r1.status).toBe(429);
    expect((await r1.json()).message).toMatch(/quá nhanh/);

    getExportPreview.mockRejectedValueOnce(new Error("boom"));
    expect((await previewGET(req("/api/export/job/preview"), ctx("job"))).status).toBe(502);
  });
});

describe("GET /data-management/export/[entity] (tải file)", () => {
  it("forward body theo stream + Content-Disposition của backend, thêm nosniff và no-store", async () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("a,b\n1,2\n"));
        c.close();
      },
    });
    downloadExport.mockResolvedValue(
      new Response(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="jobs.csv"',
          "Set-Cookie": "x=1",
        },
      }),
    );
    const res = await downloadGET(req("/data-management/export/job?status=OPEN&format=csv"), ctx("job"));
    expect(requireStaff).toHaveBeenCalled();
    expect(downloadExport).toHaveBeenCalledWith("job", { status: "OPEN" }, "csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="jobs.csv"');
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Set-Cookie")).toBeNull(); // không chuyển tiếp header lạ của backend
    expect(await res.text()).toBe("a,b\n1,2\n");
  });

  it("thiếu format -> mặc định xlsx; format lạ / entity lạ / bộ lọc sai -> trang lỗi, không gọi backend", async () => {
    downloadExport.mockResolvedValue(new Response("x"));
    await downloadGET(req("/data-management/export/company"), ctx("company"));
    expect(downloadExport).toHaveBeenCalledWith("company", {}, "xlsx");
    downloadExport.mockClear();

    const bad = await downloadGET(req("/data-management/export/job?format=pdf"), ctx("job"));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("Content-Type")).toContain("text/html");
    expect((await downloadGET(req("/data-management/export/x"), ctx("x"))).status).toBe(404);
    expect((await downloadGET(req("/data-management/export/job?limit=x"), ctx("job"))).status).toBe(400);
    expect(downloadExport).not.toHaveBeenCalled();
  });

  it("lỗi backend -> trang HTML có mã đúng, message được escape", async () => {
    downloadExport.mockRejectedValueOnce(new ApiError("<script>alert(1)</script>", 400));
    const res = await downloadGET(req("/data-management/export/job"), ctx("job"));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");

    downloadExport.mockRejectedValueOnce(new ApiError("x", 429));
    expect((await downloadGET(req("/data-management/export/job"), ctx("job"))).status).toBe(429);
    downloadExport.mockRejectedValueOnce(new Error("net"));
    expect((await downloadGET(req("/data-management/export/job"), ctx("job"))).status).toBe(502);
  });
});
