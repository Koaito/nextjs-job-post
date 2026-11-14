// Chạy MỘT lần trước mọi spec:
//   1. (tuỳ chọn) nạp lại dữ liệu nền nếu có E2E_DATABASE_URL — xoá sạch + tạo tài khoản mẫu.
//   2. kiểm backend sống và đúng API key — lỗi ở đây phải nói rõ, không để 30 test cùng đỏ vì một nguyên nhân.
//   3. tạo công ty + job mẫu bằng REST (đi qua đúng validation của API), bằng tài khoản seed-admin.
import { spawnSync } from "node:child_process";
import { ACCOUNTS, API_KEY, BACKEND_URL, DATA_JOB_TITLE, PASSWORD, SEED_JOB_COUNT, freshClientIp } from "./helpers";

async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      "X-API-Key": API_KEY,
      "X-Client-IP": freshClientIp(), // backend chỉ tin header này khi có API key hợp lệ
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${rest.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export default async function globalSetup() {
  if (process.env.E2E_DATABASE_URL) {
    const r = spawnSync("node", ["scripts/e2e-db.mjs"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("Không nạp lại được dữ liệu nền e2e (xem log phía trên).");
  } else {
    console.warn(
      "[e2e] Không đặt E2E_DATABASE_URL: coi như DB đã ở trạng thái ban đầu (CI luôn như vậy; " +
        "chạy lại local thì chạy `npm run e2e:db` trước, nếu không spec nhắn tin sẽ lệch).",
    );
  }

  try {
    await api("/health");
  } catch (err) {
    throw new Error(
      `Backend ${BACKEND_URL} không phản hồi đúng (kiểm tra đã chạy uvicorn và E2E_API_KEY khớp API_KEY). ${String(err)}`,
    );
  }

  // Session token mờ (Mục 3): backend vẫn chấp nhận Bearer của nó như mọi route cần đăng nhập.
  const { session_token: token } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ACCOUNTS.seedAdmin.email, password: PASSWORD }),
  });

  const company = await api("/companies", {
    method: "POST",
    token,
    body: JSON.stringify({ company_name: "E2E Công ty Alpha", website: "https://alpha.example" }),
  });

  const jobs = [
    { job_title: DATA_JOB_TITLE, matching_industry: "Data Analysis", level_code: "Intern", province_name: "Hà Nội" },
    ...Array.from({ length: SEED_JOB_COUNT - 1 }, (_, i) => ({
      job_title: `E2E Code Job ${String(i + 1).padStart(2, "0")}`,
      matching_industry: "Code",
      level_code: "Fresher",
      province_name: "Hồ Chí Minh",
    })),
  ];
  for (const job of jobs) {
    await api("/jobs", {
      method: "POST",
      token,
      body: JSON.stringify({ ...job, company_id: company.company_id, work_type: "FULL_TIME" }),
    });
  }
}
