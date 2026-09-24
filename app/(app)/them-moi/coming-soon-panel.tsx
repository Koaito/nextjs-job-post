// app/(app)/them-moi/coming-soon-panel.tsx
// Panel tạm cho tab Công ty / Người liên hệ ở /them-moi — theo đúng
// quyết định của user ở vòng trao đổi Round 4 ("chờ đi, làm đúng quy
// trình" / "chờ, th ko làm trước plan"): 2 tab này cần <CompanyForm>
// đầy đủ (company_size có validate riêng, partnership_potential...)
// và luồng tạo contact (company_id ở path khi gọi API thật, xem
// blueprints/contacts.py::add_any() bên Flask) — cả 2 đều thuộc Nhóm 2
// của plan, CHƯA làm ở Round 4 này để không đi trước plan.
//
// Đây KHÔNG phải link chết: tab vẫn hiện trong shell (đúng cấu trúc 3
// tab plan yêu cầu ở /them-moi), chỉ nội dung bên trong chưa có form
// thật.

export function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      <p>
        Form thêm {label} sẽ có ở bản cập nhật sau (Nhóm 2 của kế hoạch), khi{" "}
        <code className="rounded bg-muted px-1 py-0.5">&lt;CompanyForm&gt;</code> đầy đủ hoàn
        thiện.
      </p>
    </div>
  );
}
