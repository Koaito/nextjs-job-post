// lib/load-section.ts
// Nạp MỘT khối dữ liệu của trang Server Component có nhiều khối (tab Lịch sử: 3 lời gọi; tab Tình trạng dữ liệu: 2),
// sao cho khối lỗi chỉ báo lỗi riêng nó, các khối khác vẫn hiện.
//
// QUY TẮC QUAN TRỌNG: 401 KHÔNG bị nuốt thành "lỗi khối". 401 nghĩa là phiên đã chết (hết hạn, bị đăng nhập nơi khác,
// bị thu hồi), mọi khối khác cũng sẽ chết theo, nên phải ném tiếp để cơ chế chung xử lý thay vì vẽ ra một trang "nửa
// sống" toàn khung báo lỗi. Quy tắc này phải đúng cả khi 401 chỉ xảy ra ở lời gọi THỨ HAI trở đi (lời gọi đầu còn
// thành công bằng phiên vừa chết ngay sau đó): Promise.all ném 401 thì cả trang ném, không ghép kết quả nửa vời.
// (Bản trước dùng refresh token xoay vòng nên cần "dedupe refresh"; từ Pha B là phiên mờ, không còn refresh, ca này
// quy về: 401 ở bất kỳ lời gọi nào cũng phải dừng cả trang, không lặp, không thử lại.)

import { ApiError } from "@/lib/api/client";

export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string };

export async function loadSection<T>(
  fn: () => Promise<T>,
  fallbackMessage = "Không tải được dữ liệu.",
): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    return { ok: false, message: err instanceof ApiError && err.message ? err.message : fallbackMessage };
  }
}
