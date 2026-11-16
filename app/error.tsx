"use client";

// app/error.tsx — trang lỗi chung cho mọi segment (500, backend sập, Render đang ngủ...).
// Phải là Client Component (Next.js yêu cầu). KHÔNG in error.message ra màn hình: message
// có thể chứa chi tiết nội bộ; chỉ `digest` (mã tra log server) mới an toàn để hiện.

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">Lỗi hệ thống</p>
        <h1 className="mt-2 text-2xl font-semibold">Có lỗi xảy ra, bạn thử lại nhé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Máy chủ có thể đang khởi động lại hoặc quá tải. Đợi vài giây rồi bấm &quot;Thử lại&quot;;
          nếu vẫn lỗi, báo team kèm mã bên dưới.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => reset()}>Thử lại</Button>
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
            Về trang chủ
          </Button>
        </div>
      </div>
    </div>
  );
}
