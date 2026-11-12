import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

// 新規登録は公開フォームに集約（売りたい）。買いたいは /buy。
export default async function NewInquiryRedirect() {
  await requireAdmin();
  redirect("/sell");
}
