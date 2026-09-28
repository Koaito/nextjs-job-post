"use client";
// app/(app)/contacts/contacts-tab-nav.tsx
// Tab-nav dùng chung của khu /contacts — tương đương <nav class="tab-nav"
// id="contactsTabNav"> ở contacts.html (Flask). Plan (Nhóm 2): tách 2 route
// con THẬT thay cho ?tab=danh-sach|quan-ly + fetch-fragment của Flask, nên
// tab đang active suy ra từ pathname (không phải state client).
//
// Tab "Quản lý mẫu email" (/contacts/email-templates) CHƯA có nội dung —
// hướng B đã chốt với user: dựng sẵn khung 2 tab, tab này disabled tới khi
// làm Phần 3 (Email templates). Khi đó chỉ cần bỏ `disabled: true`.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/contacts", label: "Danh sách contact", disabled: false },
  { href: "/contacts/email-templates", label: "Quản lý mẫu email", disabled: true },
] as const;

export function ContactsTabNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Khu vực contact" className="flex gap-1 border-b">
      {TABS.map((tab) => {
        if (tab.disabled) {
          return (
            <span
              key={tab.href}
              aria-disabled="true"
              title="Sắp có"
              className="cursor-not-allowed px-4 py-2 text-sm text-muted-foreground/60"
            >
              {tab.label} <span className="text-xs">(sắp có)</span>
            </span>
          );
        }
        // "/contacts" chỉ active đúng chính nó, không active theo tiền tố
        // (sẽ trùng với /contacts/email-templates khi tab đó mở).
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
