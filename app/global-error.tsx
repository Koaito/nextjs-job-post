"use client";

// app/global-error.tsx — chỉ chạy khi chính root layout lỗi (app/error.tsx không bắt được).
// Thay thế cả <html>, nên phải tự dựng <html>/<body> và KHÔNG dựa vào font/Tailwind biến
// của layout gốc; dùng style inline tối thiểu để vẫn đọc được khi CSS không nạp.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Có lỗi xảy ra</h1>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>
            Hệ thống đang gặp sự cố. Đợi vài giây rồi thử lại.
          </p>
          {error.digest && (
            <p style={{ color: "#888", fontFamily: "monospace", fontSize: "0.75rem" }}>
              Mã lỗi: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
