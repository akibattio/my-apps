import { redirect } from "next/navigation";

// 新規登録は公開フォームに集約（売りたい）。買いたいは /buy。
export default function NewInquiryRedirect() {
  redirect("/sell");
}
