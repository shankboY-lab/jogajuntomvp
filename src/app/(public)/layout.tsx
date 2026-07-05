// Layout público: coluna mobile-first centralizada sobre fundo creme (RNF-01)
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      {children}
    </main>
  );
}
