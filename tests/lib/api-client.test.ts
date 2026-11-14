import { beforeEach, describe, expect, it, vi } from "vitest";

// client.ts phụ thuộc lib/session (cookies của Next) và client-ip-server
// (headers của Next) -> mock cả hai. getSessionToken ở đây là giả; đọc cookie thật
// được test ở tests/lib/session.test.ts. Mục 3 (session mờ): callAuthed gửi ĐÚNG MỘT LẦN,
// không refresh, không thử lại — nhóm test "không retry" bên dưới khoá điều đó.
vi.mock("@/lib/session", () => ({
  getSessionToken: vi.fn(),
}));
vi.mock("@/lib/client-ip-server", () => ({
  getClientIpHeaders: vi.fn(),
}));

import { getSessionToken } from "@/lib/session";
import { getClientIpHeaders } from "@/lib/client-ip-server";
import { ApiError, callAuthed, callAuthedStream, callPublic } from "@/lib/api/client";

const mockGetToken = vi.mocked(getSessionToken);
const mockClientIp = vi.mocked(getClientIpHeaders);

const API_URL = "https://api.test";

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function errRes(detail: unknown, status: number): Response {
  return jsonRes({ detail }, status);
}

/** fetch giả trả lần lượt từng Response (hoặc ném lỗi nếu phần tử là Error). */
function stubFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Lấy (url, init) của lần gọi fetch thứ n. */
function call(fn: ReturnType<typeof vi.fn>, n = 0) {
  const [url, init] = fn.mock.calls[n] as [string, RequestInit & { headers: Record<string, string> }];
  return { url, init, headers: init.headers };
}

/** Chờ một promise PHẢI bị từ chối bằng ApiError rồi trả lỗi đó (có kiểu). */
async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error("Mong đợi promise bị từ chối nhưng nó đã thành công");
}

beforeEach(() => {
  vi.stubEnv("CRAWLER_API_URL", API_URL);
  vi.stubEnv("CRAWLER_API_KEY", "key-xyz");
  mockGetToken.mockResolvedValue("tok-1");
  mockClientIp.mockResolvedValue({});
  // Lỗi dạng 3 gọi console.error để ghi log; giữ output test sạch.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ApiError", () => {
  it("giữ đủ field và có name = ApiError", () => {
    const e = new ApiError("msg", 400, "code_x", { a: 1 }, { error_code: "code_x", errors: [] });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
    expect(e.message).toBe("msg");
    expect(e.status).toBe(400);
    expect(e.errorCode).toBe("code_x");
    expect(e.params).toEqual({ a: 1 });
    expect(e.detail).toEqual({ error_code: "code_x", errors: [] });
  });
});

describe("callAuthed — request gửi đi", () => {
  it("gắn X-API-Key, Bearer session token, Content-Type JSON; nối CRAWLER_API_URL + path", async () => {
    const fetchMock = stubFetch(jsonRes({ ok: 1 }));
    const out = await callAuthed<{ ok: number }>("/jobs?page=1");
    expect(out).toEqual({ ok: 1 });

    const { url, headers, init } = call(fetchMock);
    expect(url).toBe(`${API_URL}/jobs?page=1`);
    expect(headers["X-API-Key"]).toBe("key-xyz");
    expect(headers["Authorization"]).toBe("Bearer tok-1");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.cache).toBe("no-store");
  });

  it("không có session token -> không gửi Authorization", async () => {
    mockGetToken.mockResolvedValue(null);
    const fetchMock = stubFetch(jsonRes({}));
    await callAuthed("/x");
    expect(call(fetchMock).headers["Authorization"]).toBeUndefined();
  });

  it("gắn X-Client-IP khi lời gọi không cache", async () => {
    mockClientIp.mockResolvedValue({ "X-Client-IP": "1.2.3.4" });
    const fetchMock = stubFetch(jsonRes({}));
    await callAuthed("/x");
    expect(call(fetchMock).headers["X-Client-IP"]).toBe("1.2.3.4");
  });

  it("lời gọi có next.revalidate: không gắn IP, không đặt cache (tránh xung đột)", async () => {
    mockClientIp.mockResolvedValue({ "X-Client-IP": "1.2.3.4" });
    const fetchMock = stubFetch(jsonRes({}));
    await callAuthed("/enums", { next: { revalidate: 300 } });
    const { headers, init } = call(fetchMock);
    expect(mockClientIp).not.toHaveBeenCalled();
    expect(headers["X-Client-IP"]).toBeUndefined();
    expect(init.cache).toBeUndefined();
    expect(init.next).toEqual({ revalidate: 300 });
  });

  it("caller tự đặt cache khác no-store: giữ nguyên và không gắn IP", async () => {
    const fetchMock = stubFetch(jsonRes({}));
    await callAuthed("/x", { cache: "force-cache" });
    expect(mockClientIp).not.toHaveBeenCalled();
    expect(call(fetchMock).init.cache).toBe("force-cache");
  });

  it("body FormData: KHÔNG tự đặt Content-Type (fetch phải tự sinh boundary)", async () => {
    const fetchMock = stubFetch(jsonRes({}));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "cv.pdf");
    await callAuthed("/me/applications", { method: "POST", body: form });
    expect(call(fetchMock).headers["Content-Type"]).toBeUndefined();
  });

  it("header của caller ghi đè header mặc định", async () => {
    const fetchMock = stubFetch(jsonRes({}));
    await callAuthed("/x", { headers: { "Content-Type": "text/plain", "X-Extra": "1" } });
    const { headers } = call(fetchMock);
    expect(headers["Content-Type"]).toBe("text/plain");
    expect(headers["X-Extra"]).toBe("1");
    expect(headers["X-API-Key"]).toBe("key-xyz");
  });

  it("204 No Content -> undefined, không parse body", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(callAuthed("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("callAuthed — chuẩn hoá lỗi (3 dạng detail của FastAPI)", () => {
  it("Dạng 1: detail object có error_code -> ApiError đủ field, detail giữ nguyên object", async () => {
    const detail = {
      error_code: "import_row_validation_failed",
      message: "File có dòng không hợp lệ",
      params: { n: 3 },
      errors: [{ row_number: 2, field_name: "email", rule: "email", message: "sai" }],
    };
    stubFetch(errRes(detail, 422));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.errorCode).toBe("import_row_validation_failed");
    expect(err.message).toBe("File có dòng không hợp lệ");
    expect(err.params).toEqual({ n: 3 });
    expect(err.detail).toEqual(detail);
  });

  it("Dạng 1 thiếu message -> message mặc định", async () => {
    stubFetch(errRes({ error_code: "x" }, 400));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err.message).toBe("Lỗi không xác định");
    expect(err.errorCode).toBe("x");
  });

  it("Dạng 2: detail là mảng Pydantic -> lấy msg phần tử đầu, không có errorCode", async () => {
    stubFetch(errRes([{ loc: ["body", "limit"], msg: "Input should be >= 1", type: "x" }], 422));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe("Input should be >= 1");
    expect(err.errorCode).toBeUndefined();
    expect(err.detail).toBeUndefined();
  });

  it("Dạng 2 phần tử đầu thiếu msg -> câu mặc định tiếng Việt", async () => {
    stubFetch(errRes([{ loc: ["body"] }], 422));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err.message).toBe("Dữ liệu gửi lên không hợp lệ.");
  });

  it("Dạng 3: detail là chuỗi (404/429) -> message chung, ghi log, không errorCode", async () => {
    stubFetch(errRes("Not Found", 404));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err.status).toBe(404);
    expect(err.message).toBe("Lỗi không xác định");
    expect(err.errorCode).toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("Dạng 3: mảng rỗng cũng rơi xuống dạng 3", async () => {
    stubFetch(errRes([], 422));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err.message).toBe("Lỗi không xác định");
  });

  it("Dạng 3: body HTML của proxy (502) không làm hỏng parse", async () => {
    stubFetch(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Lỗi không xác định");
  });

  it("log lỗi dạng 3 cắt body ở 300 ký tự và có method + path", async () => {
    stubFetch(new Response("x".repeat(1000), { status: 500 }));
    await callAuthed("/jobs", { method: "POST" }).catch(() => {});
    const msg = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(msg).toContain("500 POST /jobs");
    expect(msg.length).toBeLessThan(400);
  });

  it("lỗi mạng (fetch ném) lan thẳng, không bọc thành ApiError và không gửi lại", async () => {
    const fetchMock = stubFetch(new TypeError("fetch failed"));
    await expect(callAuthed("/x")).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("callAuthed — không retry (session mờ, Mục 3)", () => {
  it("401 token_expired -> gửi ĐÚNG 1 lần, ném ApiError 401 giữ error_code", async () => {
    const fetchMock = stubFetch(errRes({ error_code: "token_expired", message: "hết hạn" }, 401));
    const err = await rejectionOf(callAuthed("/x"));
    expect(err.status).toBe(401);
    expect(err.errorCode).toBe("token_expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["session_replaced", "session_revoked"])(
    "401 %s lan nguyên mã lên nơi gọi (để rẽ nhánh thông báo), không gửi lại",
    async (code) => {
      const fetchMock = stubFetch(errRes({ error_code: code, message: "x" }, 401));
      const err = await rejectionOf(callAuthed("/x"));
      expect(err.status).toBe(401);
      expect(err.errorCode).toBe(code);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 401, 403, 404, 429, 500, 503])("status %i: chỉ 1 lần fetch", async (status) => {
    const fetchMock = stubFetch(errRes({ error_code: "x", message: "y" }, status));
    await callAuthed("/x").catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("đọc session token đúng 1 lần cho mỗi lời gọi", async () => {
    stubFetch(errRes({ error_code: "session_revoked", message: "x" }, 401));
    await callAuthed("/x").catch(() => {});
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it("nhiều lời gọi song song cùng dùng MỘT token, không ai tranh chấp hay gọi thêm", async () => {
    const fetchMock = vi.fn();
    for (let i = 0; i < 10; i++) fetchMock.mockResolvedValueOnce(jsonRes({ n: i }));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all(Array.from({ length: 10 }, (_, i) => callAuthed(`/p${i}`)));
    expect(fetchMock).toHaveBeenCalledTimes(10);
    for (let i = 0; i < 10; i++) expect(call(fetchMock, i).headers["Authorization"]).toBe("Bearer tok-1");
  });
});

describe("callAuthedStream", () => {
  it("trả nguyên Response chưa đọc body, giữ header (Content-Disposition)", async () => {
    stubFetch(
      new Response("a,b\n1,2\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="jobs.csv"',
        },
      }),
    );
    const res = await callAuthedStream("/export/job?format=csv");
    expect(res).toBeInstanceOf(Response);
    expect(res.bodyUsed).toBe(false);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="jobs.csv"');
    expect(await res.text()).toBe("a,b\n1,2\n");
  });

  it("status >= 400 vẫn chuẩn hoá thành ApiError như callAuthed", async () => {
    stubFetch(errRes({ error_code: "import_preview_expired", message: "expired" }, 410));
    const err = await rejectionOf(callAuthedStream("/import/confirm", { method: "POST" }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(410);
    expect(err.errorCode).toBe("import_preview_expired");
  });

  it("body thường + 401 -> ném ApiError, chỉ 1 lần fetch (không còn retry)", async () => {
    const fetchMock = stubFetch(errRes({ error_code: "session_revoked", message: "x" }, 401));
    const err = await rejectionOf(callAuthedStream("/export/job", { method: "GET" }));
    expect(err.status).toBe(401);
    expect(err.errorCode).toBe("session_revoked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("body ReadableStream + 401 -> ném lỗi, chỉ 1 lần fetch", async () => {
    const fetchMock = stubFetch(errRes({ error_code: "token_expired", message: "x" }, 401));
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("data"));
        c.close();
      },
    });
    const err = await rejectionOf(callAuthedStream("/import/preview", { method: "POST", body }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("body ReadableStream + thành công -> gửi 1 lần với session token", async () => {
    const fetchMock = stubFetch(jsonRes({ preview_id: "p1" }));
    const body = new ReadableStream({
      start(c) {
        c.close();
      },
    });
    const res = await callAuthedStream("/import/preview", { method: "POST", body });
    expect(await res.json()).toEqual({ preview_id: "p1" });
    expect(call(fetchMock).headers["Authorization"]).toBe("Bearer tok-1");
  });
});

describe("callPublic", () => {
  it("gửi X-API-Key nhưng KHÔNG gọi lấy token và KHÔNG có Authorization", async () => {
    const fetchMock = stubFetch(jsonRes({ topcv: { a: "A" } }));
    const out = await callPublic<Record<string, unknown>>("/sources", { next: { revalidate: 300 } });
    expect(out).toEqual({ topcv: { a: "A" } });
    expect(mockGetToken).not.toHaveBeenCalled();
    const { headers } = call(fetchMock);
    expect(headers["X-API-Key"]).toBe("key-xyz");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("401 chỉ ném lỗi, 1 lần fetch (route công khai)", async () => {
    const fetchMock = stubFetch(errRes({ error_code: "x", message: "y" }, 401));
    await callPublic("/sources").catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lỗi chuẩn hoá thành ApiError", async () => {
    stubFetch(errRes({ error_code: "rate_limited", message: "chậm lại" }, 429));
    const err = await rejectionOf(callPublic("/sources"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.errorCode).toBe("rate_limited");
  });
});
