import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { BottomNav } from "@/components/ui/BottomNav";

// Layout autenticado: guarda extra além do middleware + bottom nav (v2-05/v2-07).
// Em >=768px a nav vira topbar (ver BottomNav).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh pb-20 md:pt-16 md:pb-8">
      <main className="mx-auto w-full max-w-md px-4 pt-6 lg:max-w-2xl">{children}</main>
      <BottomNav />
    </div>
  );
}
