import Link from "next/link";

// FE-15 — página legal (RNF-08). Conteúdo placeholder a validar com jurídico.
export const metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <article className="prose-sm mx-auto flex max-w-md flex-col gap-4 py-4">
      <h1 className="text-2xl font-extrabold">Termos de Uso</h1>
      <p className="text-xs text-muted">Última atualização: julho de 2026 · versão MVP</p>

      <section className="flex flex-col gap-2 text-sm text-ink/90">
        <h2 className="font-bold">1. O serviço</h2>
        <p>
          O JogaJunto conecta pessoas que querem jogar jogos de tabuleiro presencialmente. O
          encontro e a conversa acontecem fora da plataforma (WhatsApp/Telegram), por decisão e
          responsabilidade dos usuários.
        </p>
        <h2 className="font-bold">2. Cadastro</h2>
        <p>
          Você é responsável pelas informações do seu perfil e por manter sua senha segura. É
          proibido criar perfis falsos ou usar o serviço para fins comerciais ou abusivos.
        </p>
        <h2 className="font-bold">3. Dados do BoardGameGeek</h2>
        <p>
          As informações de jogos (nome, ano, imagem) vêm da API pública do BoardGameGeek e são
          usadas conforme os termos daquele serviço, apenas para identificação dos jogos.
        </p>
        <h2 className="font-bold">4. Segurança nos encontros</h2>
        <p>
          Recomendamos combinar partidas em locais públicos (luderias, cafés). O JogaJunto não faz
          verificação de identidade dos usuários.
        </p>
        <h2 className="font-bold">5. Encerramento</h2>
        <p>
          Você pode excluir sua conta a qualquer momento na área Perfil — a exclusão é imediata e
          irreversível.
        </p>
      </section>

      <Link href="/login" className="text-sm font-semibold text-primary-dark hover:underline">
        ← Voltar
      </Link>
    </article>
  );
}
