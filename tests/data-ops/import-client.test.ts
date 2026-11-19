import { describe, expect, it, vi } from "vitest";
import {
  ImportClientError,
  confirmImportRequest,
  fetchCompanySuggestions,
  resolveCompany,
  uploadImportFile,
  verifyField,
} from "@/lib/data-ops/import-client";

const json = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const PID = "11111111-1111-4111-8111-111111111111";

describe("import-client", () => {
  it("upload: gửi FormData tới đúng URL, KHÔNG tự đặt Content-Type", async () => {
    const f = json(200, { ok: true, preview: { preview_id: PID, rows: [] } });
    const file = new File(["a,b\n1,2"], "x.csv", { type: "text/csv" });
    const p = await uploadImportFile("job", file, f as never);
    expect(p.preview_id).toBe(PID);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/import/job/preview");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined();
  });

  it("422 kèm mảng lỗi cấp dòng -> ImportClientError có rowErrors", async () => {
    const f = json(422, { ok: false, message: "File có dòng lỗi", code: "import_row_validation_failed", errors: [{ row_number: 3, message: "x" }] });
    const err = await uploadImportFile("job", new File(["x"], "x.csv"), f as never).catch((e) => e);
    expect(err).toBeInstanceOf(ImportClientError);
    expect(err.status).toBe(422);
    expect(err.rowErrors).toHaveLength(1);
    expect(err.previewGone).toBe(false);
  });

  it("body không phải JSON (HTML 413 của nền tảng) vẫn ra thông báo tiếng Việt đúng status", async () => {
    const f = vi.fn().mockResolvedValue(new Response("<html>Request Entity Too Large</html>", { status: 413 }));
    const err = await uploadImportFile("job", new File(["x"], "x.csv"), f as never).catch((e) => e);
    expect(err.status).toBe(413);
    expect(err.message).toMatch(/quá lớn/);
  });

  it("mạng đứt -> lỗi tiếng Việt status 0", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const err = await uploadImportFile("job", new File(["x"], "x.csv"), f as never).catch((e) => e);
    expect(err).toMatchObject({ status: 0 });
    expect(err.message).toMatch(/kết nối/);
  });

  it("410 / import_not_found -> previewGone", async () => {
    const f = json(410, { ok: false, message: "hết hạn", code: "import_preview_expired" });
    const err = await fetchCompanySuggestions("job", PID, 1, f as never).catch((e) => e);
    expect(err.previewGone).toBe(true);
    expect(f.mock.calls[0][0]).toBe(`/api/import/job/preview/${PID}/company-suggestions?row_index=1`);
  });

  it("verify: body field_name/value; field_error null khi hợp lệ", async () => {
    const f = json(200, { ok: true, row: { row_index: 2 }, field_error: null });
    const out = await verifyField("contact", PID, 2, "work_email", "a@b.vn", f as never);
    expect(out.fieldError).toBeNull();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`/api/import/contact/preview/${PID}/rows/2/verify-field`);
    expect(JSON.parse(init.body)).toEqual({ field_name: "work_email", value: "a@b.vn" });
  });

  it("verify: còn lỗi thì trả nguyên message backend", async () => {
    const f = json(200, { ok: true, row: { row_index: 2 }, field_error: { rule: "email", message: "Email sai" } });
    expect((await verifyField("contact", PID, 2, "work_email", "x", f as never)).fieldError?.message).toBe("Email sai");
  });

  it("resolve-company: null = tạo mới", async () => {
    const f = json(200, { ok: true, row: { row_index: 1 } });
    await resolveCompany("job", PID, 1, null, f as never);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ company_id: null });
  });

  it("confirm: trim ghi chú, gửi preview_id và resolutions", async () => {
    const f = json(200, { ok: true, result: { created: 1, updated: 0, skipped: 0, reactivated: 0 } });
    const r = await confirmImportRequest("job", { previewId: PID, note: "  nhập  ", resolutions: { "1": { action: "skip" } } }, f as never);
    expect(r.created).toBe(1);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ preview_id: PID, note: "nhập", resolutions: { "1": { action: "skip" } } });
  });
});
