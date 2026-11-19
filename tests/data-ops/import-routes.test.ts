import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const uploadImportPreview = vi.fn();
const getImportPreview = vi.fn();
const getImportCompanySuggestions = vi.fn();
const verifyImportField = vi.fn();
const resolveImportCompany = vi.fn();
const confirmImport = vi.fn();

vi.mock("@/lib/session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/import-export", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/import-export")>()),
  uploadImportPreview: (...a: unknown[]) => uploadImportPreview(...a),
  getImportPreview: (...a: unknown[]) => getImportPreview(...a),
  getImportCompanySuggestions: (...a: unknown[]) => getImportCompanySuggestions(...a),
  verifyImportField: (...a: unknown[]) => verifyImportField(...a),
  resolveImportCompany: (...a: unknown[]) => resolveImportCompany(...a),
  confirmImport: (...a: unknown[]) => confirmImport(...a),
}));

import { ApiError } from "@/lib/api/client";
import { POST as uploadPOST } from "@/app/api/import/[entity]/preview/route";
import { GET as previewGET } from "@/app/api/import/[entity]/preview/[id]/route";
import { GET as suggestGET } from "@/app/api/import/[entity]/preview/[id]/company-suggestions/route";
import { POST as verifyPOST } from "@/app/api/import/[entity]/preview/[id]/rows/[row]/verify-field/route";
import { POST as resolvePOST } from "@/app/api/import/[entity]/preview/[id]/rows/[row]/resolve-company/route";
import { POST as confirmPOST } from "@/app/api/import/[entity]/confirm/route";

const PID = "11111111-1111-4111-8111-111111111111";
const CID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://localhost:3100";

const post = (path: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as never;
const get = (path: string) => new Request(`http://localhost${path}`) as never;
const c = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  for (const m of [getCurrentUser, uploadImportPreview, getImportPreview, getImportCompanySuggestions, verifyImportField, resolveImportCompany, confirmImport]) m.mockReset();
  getCurrentUser.mockResolvedValue({ is_staff: true });
});

describe("guard chung", () => {
  it("POST sai Origin -> 403; chưa đăng nhập -> 401; học viên -> 403; entity lạ -> 404; không gọi backend", async () => {
    const body = { preview_id: PID, note: "x", resolutions: {} };
    expect((await confirmPOST(post("/x", body, { origin: "http://evil.test" }), c({ entity: "job" }))).status).toBe(403);
    expect((await confirmPOST(post("/x", body, {}), c({ entity: "job" }))).status).toBe(403);
    getCurrentUser.mockResolvedValueOnce(null);
    expect((await confirmPOST(post("/x", body), c({ entity: "job" }))).status).toBe(401);
    getCurrentUser.mockResolvedValueOnce({ is_staff: false });
    expect((await confirmPOST(post("/x", body), c({ entity: "job" }))).status).toBe(403);
    expect((await confirmPOST(post("/x", body), c({ entity: "user" }))).status).toBe(404);
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("mọi phản hồi no-store; GET không đòi Origin", async () => {
    getImportPreview.mockResolvedValue({ preview_id: PID });
    const r = await previewGET(get("/x"), c({ entity: "job", id: PID }));
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect((await previewGET(get("/x"), c({ entity: "job", id: "abc" }))).status).toBe(400);
  });
});

describe("upload", () => {
  it("không phải multipart -> 400, không gọi backend; multipart -> forward stream + content-type nguyên bản", async () => {
    expect((await uploadPOST(post("/x", {}), c({ entity: "job" }))).status).toBe(400);
    expect(uploadImportPreview).not.toHaveBeenCalled();

    uploadImportPreview.mockResolvedValue({ preview_id: PID, rows: [] });
    const ct = "multipart/form-data; boundary=----abc";
    const req = new Request("http://localhost/x", { method: "POST", headers: { origin: ORIGIN, "content-type": ct }, body: "--x", duplex: "half" } as never);
    const res = await uploadPOST(req as never, c({ entity: "job" }));
    expect(res.status).toBe(200);
    const [entity, body, opts] = uploadImportPreview.mock.calls[0];
    expect(entity).toBe("job");
    expect(body).toBeInstanceOf(ReadableStream);
    expect(opts).toEqual({ contentType: ct });
  });

  it("422 từ backend -> giữ status, mã và mảng lỗi cấp dòng", async () => {
    uploadImportPreview.mockRejectedValue(
      new ApiError("File có dòng không hợp lệ", 422, "import_row_validation_failed", undefined, { errors: [{ row_number: 2, message: "x" }] }),
    );
    const req = new Request("http://localhost/x", { method: "POST", headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=b" }, body: "--b", duplex: "half" } as never);
    const res = await uploadPOST(req as never, c({ entity: "job" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, code: "import_row_validation_failed", errors: [{ row_number: 2 }] });
  });

  it("lỗi mạng -> 502", async () => {
    uploadImportPreview.mockRejectedValue(new TypeError("fetch failed"));
    const req = new Request("http://localhost/x", { method: "POST", headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=b" }, body: "--b", duplex: "half" } as never);
    expect((await uploadPOST(req as never, c({ entity: "job" }))).status).toBe(502);
  });
});

describe("preview hết hạn / không còn", () => {
  it("410 -> thông báo tiếng Việt + code để client bỏ preview", async () => {
    getImportPreview.mockRejectedValue(new ApiError("Preview expired", 410, "import_preview_expired"));
    const res = await previewGET(get("/x"), c({ entity: "job", id: PID }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("import_preview_expired");
    expect(body.message).toMatch(/hết hạn/);
  });
});

describe("suggestions / verify / resolve", () => {
  it("suggestions: row_index sai -> 400; hợp lệ -> gọi đúng tham số", async () => {
    expect((await suggestGET(get("/x?row_index=-1"), c({ entity: "job", id: PID }))).status).toBe(400);
    expect((await suggestGET(get("/x"), c({ entity: "job", id: PID }))).status).toBe(400);
    getImportCompanySuggestions.mockResolvedValue([{ company_id: CID }]);
    const res = await suggestGET(get("/x?row_index=4"), c({ entity: "job", id: PID }));
    expect(getImportCompanySuggestions).toHaveBeenCalledWith("job", PID, 4);
    expect((await res.json()).suggestions).toHaveLength(1);
  });

  it("verify: kiểm body, trả row + field_error", async () => {
    const ctx = c({ entity: "contact", id: PID, row: "2" });
    expect((await verifyPOST(post("/x", { field_name: "a" }), ctx)).status).toBe(400);
    expect((await verifyPOST(post("/x", { field_name: "", value: "v" }), ctx)).status).toBe(400);
    expect((await verifyPOST(post("/x", "không phải json"), ctx)).status).toBe(400);
    expect((await verifyPOST(post("/x", { field_name: "a", value: "v" }), c({ entity: "contact", id: PID, row: "x" }))).status).toBe(400);
    expect(verifyImportField).not.toHaveBeenCalled();

    verifyImportField.mockResolvedValue({ row: { row_index: 2 }, field_error: null });
    const res = await verifyPOST(post("/x", { field_name: "work_email", value: "a@b.vn" }), ctx);
    expect(verifyImportField).toHaveBeenCalledWith("contact", PID, 2, "work_email", "a@b.vn");
    expect(await res.json()).toEqual({ ok: true, row: { row_index: 2 }, field_error: null });
  });

  it("resolve-company: null và __new__ -> tạo mới; UUID -> chọn; giá trị khác -> 400", async () => {
    const ctx = c({ entity: "job", id: PID, row: "1" });
    resolveImportCompany.mockResolvedValue({ row_index: 1 });
    await resolvePOST(post("/x", { company_id: null }), ctx);
    await resolvePOST(post("/x", { company_id: "__new__" }), ctx);
    await resolvePOST(post("/x", { company_id: CID }), ctx);
    expect(resolveImportCompany.mock.calls.map((a) => a[3])).toEqual([null, null, CID]);
    expect((await resolvePOST(post("/x", { company_id: "abc" }), ctx)).status).toBe(400);
    expect((await resolvePOST(post("/x", {}), ctx)).status).toBe(400);
    expect(resolveImportCompany).toHaveBeenCalledTimes(3);
  });
});

describe("confirm", () => {
  const ctx = c({ entity: "job" });
  it("kiểm hình dạng: thiếu ghi chú / preview_id sai / resolutions không phải object -> 400", async () => {
    expect((await confirmPOST(post("/x", { preview_id: PID, note: "  ", resolutions: {} }), ctx)).status).toBe(400);
    expect((await confirmPOST(post("/x", { preview_id: "x", note: "a", resolutions: {} }), ctx)).status).toBe(400);
    expect((await confirmPOST(post("/x", { preview_id: PID, note: "a", resolutions: [] }), ctx)).status).toBe(400);
    expect((await confirmPOST(post("/x", { preview_id: PID, note: "a" }), ctx)).status).toBe(400);
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("hợp lệ -> gọi backend, trả kết quả", async () => {
    confirmImport.mockResolvedValue({ created: 1, updated: 0, skipped: 0, reactivated: 0 });
    const res = await confirmPOST(post("/x", { preview_id: PID, note: "nhập", resolutions: { "1": { action: "skip" } } }), ctx);
    expect(confirmImport).toHaveBeenCalledWith("job", { previewId: PID, note: "nhập", resolutions: { "1": { action: "skip" } } });
    expect((await res.json()).result.created).toBe(1);
  });

  it("422 resolution sai -> giữ status và message tiếng Việt của backend", async () => {
    confirmImport.mockRejectedValue(new ApiError("Dòng 3 cần chọn level", 422, "import_row_resolution_failed"));
    const res = await confirmPOST(post("/x", { preview_id: PID, note: "a", resolutions: {} }), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe("Dòng 3 cần chọn level");
  });
});
