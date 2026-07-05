import Link from "next/link";

// FE-15 — página legal LGPD (RNF-08). Conteúdo placeholder a validar com jurídico.
export const metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <article className="prose-sm mx-auto flex max-w-md flex-col gap-4 py-4">
      <h1 className="text-2xl font-extrabold">Política de Privacidade</h1>
      <p className="text-xs text-muted">Última atualização: julho de 2026 · versão MVP · LGPD</p>

      <section className="flex flex-col gap-2 text-sm text-ink/90">
        <h2 className="font-bold">1. Localização — finalidade única</h2>
        <p>
          Coletamos sua localização (com consentimento explícito) com uma única finalidade: calcular
          a distância entre você e outros jogadores.{" "}
          <strong>Suas coordenadas nunca são exibidas a ninguém</strong> — outros usuários veem
          apenas a distância aproximada (ex.: &ldquo;a ~600 m&rdquo;), e as coordenadas são
          armazenadas com precisão reduzida (~110 m).
        </p>
        <h2 className="font-bold">2. Contato</h2>
        <p>
          Seu WhatsApp/Telegram só é revelado a outro usuário depois de um match — isto é, quando
          vocês dois demonstraram interesse mútuo em jogar.
        </p>
        <h2 className="font-bold">3. Dados que coletamos</h2>
        <p>
          E-mail, nome/apelido, foto (opcional), cidade/bairro, coordenadas aproximadas, raio de
          busca, contato (WhatsApp/Telegram), coleção de jogos e eventos de uso do produto (anônimos
          após exclusão de conta).
        </p>
        <h2 className="font-bold">4. Seus direitos (LGPD)</h2>
        <p>
          Você pode acessar, corrigir e excluir seus dados a qualquer momento. A exclusão de conta
          apaga perfil, coleção, convites e matches; eventos analíticos são anonimizados.
        </p>
        <h2 className="font-bold">5. Contato do controlador</h2>
        <p>Dúvidas sobre privacidade: contato@jogajunto.app</p>
      </section>

      <Link href="/login" className="text-sm font-semibold text-primary-dark hover:underline">
        ← Voltar
      </Link>
    </article>
  );
}
