import { redirect } from "next/navigation";

// o middleware (BE-04) decide o destino real conforme o estado da conta
export default function RootPage() {
  redirect("/home");
}
