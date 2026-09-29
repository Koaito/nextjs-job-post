"use client";
// app/(app)/dashboard/monthly-jd-chart.tsx
// Biểu đồ cột "JD theo tháng — mới thêm vs đã hết hạn (6 tháng gần
// nhất)" — thay Chart.js UMD + plugin canvas tự vẽ số (afterDatasetsDraw,
// ctx.fillText) ở dashboard.html bằng recharts (plan Nhóm 3 / Phần 1 mục
// 2.2). Số trên đầu cột dùng <LabelList> có sẵn của recharts.
//
// GIỮ ĐÚNG quy tắc của bản Chart.js: cột giá trị 0/null/undefined KHÔNG
// vẽ số (tránh dãy số "0" rối mắt trên cột rỗng) — đây là chi tiết cố ý,
// không phải giới hạn kỹ thuật, nên formatter phải áp lại ở đây.
//
// Dữ liệu (labels/added/expired) do Server Component tính sẵn theo giờ VN
// (lib/dashboard/overview.ts::jobsByMonth) — component này chỉ vẽ.

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Cùng màu 2 cột với bản Flask: cam (--accent) cho "mới thêm", xanh
// teal (--teal) cho "hết hạn". Dùng biến CSS thương hiệu (globals.css).
const COLOR_ADDED = "var(--brand-accent)";
const COLOR_EXPIRED = "var(--brand-teal)";

function labelFormatter(value: unknown): string {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

export function MonthlyJdChart({
  labels,
  added,
  expired,
}: {
  labels: string[];
  added: number[];
  expired: number[];
}) {
  const data = labels.map((label, i) => ({ label, added: added[i] ?? 0, expired: expired[i] ?? 0 }));

  return (
    <div
      role="img"
      aria-label="Biểu đồ cột số JD mới thêm và số JD đã hết hạn theo tháng, 6 tháng gần nhất"
      className="h-80 w-full"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 320 }}>
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          {/* itemSorter={null}: recharts 3 mặc định sắp chú thích theo tên (A-Z) nên
              "JD hết hạn" nhảy lên trước "JD mới thêm"; tắt để giữ đúng thứ tự
              khai báo cột như bản Chart.js (mới thêm -> hết hạn). */}
          <Legend verticalAlign="top" align="center" itemSorter={null} />
          <Bar dataKey="added" name="JD mới thêm" fill={COLOR_ADDED} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="added" position="top" formatter={labelFormatter} fontSize={11} fontWeight={600} />
          </Bar>
          <Bar dataKey="expired" name="JD hết hạn" fill={COLOR_EXPIRED} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="expired" position="top" formatter={labelFormatter} fontSize={11} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
