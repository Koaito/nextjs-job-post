"use server";

// lib/actions/contact-actions.ts
// Phần 2, mục 6 (chat243.txt/chat244.txt) — CHỈ có hardDeleteContactAction()
// cho nút "Xoá hẳn" ở /companies/[companyId] (khối "Đã xoá"). CHƯA làm:
// createContact/updateContact/assignContact/deleteContact (soft) — thuộc
// Phần 2 mục 1+2 (<ContactForm>, /contacts), đang làm ở phiên khác, không
// đụng vào đây để tránh trùng lặp/conflict khi merge.

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { hardDeleteContact, isContactNotFound } from "@/lib/api/contacts";

export interface ContactNoteActionResult {
  ok: boolean;
  message: string;
}

/**
 * DELETE /companies/{company_id}/contacts/{contact_id}/hard — note BẮT
 * BUỘC (khớp <NoteConfirmDialog noteRequired>, cùng pattern
 * deleteCompanyAction()). Trả thẳng message lỗi từ backend khi 409
 * (contact_still_active / contact_has_links) — 2 message đó đã đủ rõ
 * bằng tiếng Việt để hiện trong dialog, không cần tự soạn lại.
 */
export async function hardDeleteContactAction(
  companyId: string,
  contactId: string,
  note: string,
): Promise<ContactNoteActionResult> {
  try {
    await hardDeleteContact(companyId, contactId, note);
    revalidatePath(`/companies/${companyId}`);
    return { ok: true, message: "Đã xoá hẳn người liên hệ." };
  } catch (err) {
    if (isContactNotFound(err)) {
      revalidatePath(`/companies/${companyId}`);
      return { ok: true, message: "Đã xoá hẳn người liên hệ." };
    }
    const message = err instanceof ApiError ? err.message : "Không thể xoá hẳn người liên hệ, thử lại sau.";
    return { ok: false, message };
  }
}
