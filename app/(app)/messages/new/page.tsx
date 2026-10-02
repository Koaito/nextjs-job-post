// app/(app)/messages/new/page.tsx
// Tương đương messages_new.html + blueprints/messages.py::new_message()
// (Flask) — tìm người để bắt đầu hội thoại mới. Nhóm 4, Phần 1/3.
//
// Backend TỰ lọc kết quả theo role người tìm (học viên chỉ thấy ss_team/
// admin, SS/admin thấy mọi role) — trang hiện đúng nguyên kết quả trả về,
// KHÔNG viết thêm lớp lọc role nào (plan Nhóm 4: lọc 2 nơi dễ lệch nhau).
// Ngoại lệ DUY NHẤT: dòng của chính mình (backend không loại người tìm
// khỏi kết quả) hiện dạng không bấm được, vì /messages/<id của mình> luôn
// bị chặn (plan Nhóm 4: chặn tự chat với chính mình).
//
// Tìm kiếm là form GET thuần (?q=) -> URL chia sẻ/refresh được, không cần
// state client. Lỗi tìm (kể cả 429: backend giới hạn 20 lần/phút) -> banner
// tại chỗ, giữ nguyên ô nhập.
// force-dynamic: kết quả phụ thuộc người gọi và q, không được cache.

import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import {
  SEARCH_PEOPLE_MAX_LENGTH,
  describeMessagesError,
  searchPeople,
  type PersonSearchResult,
} from "@/lib/api/messages";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";
import { avatarInitial, buildThreadHref } from "@/lib/messages";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nhắn tin mới — MindX Career Hub",
};

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  // Cắt theo ràng buộc backend (max 100) để gõ dài quá không bị 422.
  const q = (rawQ ?? "").trim().slice(0, SEARCH_PEOPLE_MAX_LENGTH);

  let results: PersonSearchResult[] = [];
  let error: string | null = null;
  if (q) {
    try {
      results = await searchPeople(q);
    } catch (err) {
      error = describeMessagesError(err, "Không tìm được người dùng, thử lại sau.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Nhắn tin</span>
          <h1 className="font-heading text-3xl font-semibold">Nhắn tin mới</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {user.is_staff
              ? "Tìm học viên hoặc SS/admin khác để bắt đầu hội thoại."
              : "Tìm 1 SS/admin để gửi yêu cầu nhắn tin. Bạn cần được SS chấp nhận trước khi nhắn tiếp."}
          </p>
        </div>
        <Link href="/messages" className={buttonVariants({ variant: "outline" })}>
          ← Quay lại tin nhắn
        </Link>
      </header>

      <form method="get" action="/messages/new" className="flex max-w-xl gap-2.5" role="search">
        <input
          type="text"
          name="q"
          defaultValue={q}
          maxLength={SEARCH_PEOPLE_MAX_LENGTH}
          placeholder="Nhập tên…"
          aria-label="Tìm theo tên"
          autoFocus
          autoComplete="off"
          className="flex-1 rounded-md border bg-background px-3.5 py-2.5 text-sm"
        />
        <button type="submit" className={buttonVariants()}>
          Tìm
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {q && !error && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((person) => {
            const isSelf = person.id === user.ss_user_id;
            const body = (
              <>
                <div
                  aria-hidden="true"
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue-soft)] text-[15px] font-bold text-[var(--brand-blue)]"
                >
                  {avatarInitial(person.full_name)}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {/* Text thuần (JSX tự escape) — tên do người dùng đặt. */}
                  <strong>{person.full_name}</strong>
                  <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-xs">
                    {ROLE_LABELS[person.role] ?? person.role}
                  </span>
                </div>
                {isSelf ? (
                  <span className="ml-auto text-[13px] text-muted-foreground">Đây là bạn</span>
                ) : (
                  <span className="ml-auto text-[13px] font-semibold text-[var(--brand-accent)]">Nhắn tin →</span>
                )}
              </>
            );
            const rowClass =
              "flex items-center gap-3.5 rounded-[var(--radius)] border border-border bg-card px-[18px] py-3";
            return isSelf ? (
              <div key={person.id} className={rowClass + " opacity-70"}>
                {body}
              </div>
            ) : (
              <Link
                key={person.id}
                href={buildThreadHref(person.id, person.full_name, person.role)}
                className={rowClass + " hover:border-foreground"}
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}

      {q && !error && results.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          {/* Text thuần: q là chuỗi người dùng gõ. */}
          <p>Không tìm thấy ai khớp với &ldquo;{q}&rdquo;.</p>
        </div>
      )}
    </div>
  );
}
