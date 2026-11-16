// app/not-found.tsx — 404 chung (URL không tồn tại, hoặc gọi notFound()).
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Đường dẫn không đúng, hoặc nội dung đã bị xoá.
        </p>
        <div className="mt-6 flex justify-center">
          <Button render={<Link href="/jobs" />} nativeButton={false}>
            Xem danh sách job
          </Button>
        </div>
      </div>
    </div>
  );
}
