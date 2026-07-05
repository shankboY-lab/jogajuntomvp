# PRD — MVP "Pareador de Jogos de Tabuleiro" (JogaJunto)

**Produto:** App/site para encontrar pessoas próximas que querem jogar o mesmo jogo de tabuleiro
**Tipo de documento:** PRD de MVP (decisão-primeiro)
**Versão:** 2.0 — jornada alinhada ao fluxograma oficial, catálogo via BGG e pareamento por aceite mútuo
**Autor:** Product Management
**Status:** Para refinamento por engenharia e design

> Nota de leitura: itens marcados com **(premissa)** são decisões assumidas para destravar a escrita e que devem ser confirmadas com o time. Itens marcados com **(a validar)** dependem de dado que ainda não temos.

### O que mudou da v1 → v2 (changelog)

1. **Jornada reescrita conforme o fluxograma oficial:** acesso → login → _já tem cadastro?_ → login **ou** cadastro de novo usuário → _primeiro acesso?_ → configuração de perfil → home. Usuário recorrente já cadastrado e com perfil vai direto para a home.
2. **Catálogo de jogos passa a ser alimentado pela API pública do BoardGameGeek (BGG XML API2):** ao digitar o nome do jogo no perfil, o sistema consulta a BGG e devolve candidatos para o usuário **confirmar** qual jogo entra na sua coleção. Substitui o catálogo curado manualmente da v1.
3. **Home com dois modos de busca** (antes era um só): (1) _"Quero jogar"_ — indico um jogo que possuo e quero jogar, para achar quem quer o mesmo; (2) _"Buscar jogos"_ — procuro jogos específicos que outras pessoas têm e sinalizaram querer jogar.
4. **Pareamento por aceite mútuo ("match") antes de liberar contato:** o contato (WhatsApp/Telegram) **deixa de ser exposto diretamente** na lista. Só é compartilhado depois que **as duas partes confirmam** que querem jogar juntas. Isso resolve a decisão pendente de privacidade de contato da v1 (seção 9) na direção "aceite mútuo".

---

## 1. Contexto do problema

Pessoas que gostam de jogos de tabuleiro frequentemente possuem jogos que exigem mais de um jogador, mas têm dificuldade de reunir parceiros disponíveis e geograficamente próximos para um jogo específico. O resultado é jogo encalhado na prateleira e uma comunidade fragmentada, que hoje se organiza de forma improvisada em grupos genéricos de redes sociais, sem filtro por jogo nem por distância.

Não temos ainda dado quantitativo próprio sobre o tamanho dessa dor **(a validar)**. A premissa de trabalho é que existe demanda reprimida de "achar com quem jogar o jogo X aqui perto" **(premissa)**, e este MVP existe justamente para confirmar ou derrubar essa premissa antes de qualquer investimento maior.

---

## 2. Hipótese e métrica de sucesso

**Hipótese:** Acreditamos que oferecer uma busca de pessoas próximas filtrada por jogo específico, com um passo de aceite mútuo, fará com que usuários cadastrados iniciem contato real com potenciais parceiros de jogo, medido pela taxa de matches que evoluem para contato.

**Métrica primária (de validação da hipótese):**

- **Taxa de contato pós-match:** % de usuários que realizam ao menos uma busca, obtêm ao menos um match (aceite mútuo) **e** clicam para abrir o contato (WhatsApp/Telegram). Meta de referência a definir com o time após o baseline **(a validar)**.

**Métricas secundárias (de saúde do funil):**

- % de cadastros que concluem o perfil (perfil completo = localização + ao menos 1 jogo na coleção).
- % de usuários que realizam ao menos uma busca (em qualquer dos dois modos).
- % de buscas que retornam ao menos 1 resultado (proxy de liquidez/densidade).
- **Taxa de interesse → match:** % de sinais de interesse ("quero jogar") enviados que viram match (aceite mútuo). Mede fricção do novo passo.

**Por que essas métricas:** o gargalo de um produto de pareamento é densidade. Medir "buscas com zero resultado" e "interesses sem reciprocidade" desde o dia 1 nos avisa cedo se o problema é o produto, o passo de match ou a falta de massa numa mesma região.

---

## 3. Público e job-to-be-done

**Público-alvo (premissa):** entusiastas de jogos de tabuleiro, adultos, que já possuem ao menos um jogo e moram em centros urbanos com alguma densidade de jogadores. Confortáveis em usar WhatsApp/Telegram para combinar encontros.

**Job-to-be-done principal:**

> Quando eu tenho um jogo que quero jogar mas ninguém disponível por perto, quero encontrar rapidamente outras pessoas próximas interessadas naquele mesmo jogo e confirmar interesse mútuo antes de trocar contato, para combinar uma partida com segurança e sem depender de sorte.

**Jobs secundários atendidos:**

- "Quero ser encontrável por outras pessoas que procuram um jogo que eu tenho e quero jogar."
- "Quero descobrir quais jogos as pessoas perto de mim têm disponível e querem jogar."
- "Quero falar com a pessoa por um canal que já uso, mas só depois que os dois toparmos."

---

## 4. Escopo (entra) — P0

Cada item serve ao happy path do fluxograma: _entrar → (login ou cadastro) → configurar perfil → na home escolher um dos dois modos de busca → encontrar → dar match → liberar o contato._

1. **Autenticação (Google OAuth + E-mail/Senha).** Porta de entrada e o que torna o usuário "encontrável". A tela de login segue a especificação da v1 (mantida sem alterações).
2. **Cadastro de novo usuário.** Para quem ainda não tem conta, um fluxo de criação de conta (e-mail/senha ou Google) que, ao concluir, leva à configuração de perfil.
3. **Roteamento por estado da conta (conforme fluxograma):** ao logar, o sistema verifica _primeiro acesso / perfil incompleto_. Se for o caso, direciona para a configuração de perfil; caso contrário, vai direto para a home.
4. **Perfil básico** (nome, foto opcional, localização com cidade/bairro + raio de distância, e **coleção de jogos que possui**). É a matéria-prima da busca.
5. **Cadastro de jogos assistido pela BGG XML API2.** Ao digitar o nome do jogo, o sistema consulta o BoardGameGeek e retorna candidatos (nome + ano + capa quando disponível) para o usuário **confirmar** qual jogo entra na sua coleção. Padroniza nomes/edições e permite o cruzamento confiável entre usuários.
6. **Home com dois modos de busca:**
   - **Modo A — "Quero jogar":** o usuário escolhe um jogo da sua coleção e sinaliza que quer jogá-lo agora; o sistema encontra pessoas próximas que também querem jogar aquele jogo.
   - **Modo B — "Buscar jogos":** o usuário pesquisa um jogo específico (via catálogo/BGG) e vê pessoas próximas que têm aquele jogo e sinalizaram querer jogar.
7. **Lista de resultados** de pessoas/disponibilidades compatíveis, dentro do raio, ordenada por distância.
8. **Sinal de interesse + match (aceite mútuo).** O usuário envia "quero jogar" para um resultado; o outro recebe o pedido e, ao aceitar, forma-se o **match**. Só então o contato é liberado para ambos.
9. **Liberação de contato pós-match.** Após o match, o app oferece o redirecionamento para WhatsApp ou Telegram do parceiro. Entrega a conexão sem construir e moderar um chat interno.

---

## 5. Fora de escopo (não entra)

- Chat interno / mensageria própria (substituído pelo redirecionamento a WhatsApp/Telegram **após o match**).
- Sistema de avaliações, reputação ou verificação de identidade.
- Agendamento de partidas, criação de eventos, salas ou grupos.
- **Algoritmo de recomendação / "match score" sofisticado.** Atenção: aqui "match" significa **aceite mútuo** (handshake de interesse), **não** um algoritmo de pontuação. A lista continua filtrada e ordenada por distância.
- Notificações push e e-mails de engajamento. Os pedidos de interesse e os matches são exibidos **dentro do app** (área de "Convites/Matches"); sem push na v1 **(premissa)**.
- App nativo (iOS/Android). O MVP é **web, mobile-first** (ver seção 7).
- Biblioteca/coleção rica renderizada no app (mecânicas, número de jogadores etc.). Usamos apenas os campos mínimos que a BGG devolve (nome, ano, capa/thumbnail).
- Importar coleção inteira do BGG por usuário/username. Na v1, o usuário adiciona jogo a jogo com confirmação **(premissa)**.
- Filtros avançados de busca (por nível, idioma, disponibilidade de horário).
- Monetização de qualquer tipo.

---

## 6. Requisitos funcionais

Numerados e testáveis. RF = Requisito Funcional.

**Autenticação, cadastro e roteamento**

- RF-01 — O sistema deve permitir login via Google (OAuth). _(mantido da v1)_
- RF-02 — O sistema deve permitir login via e-mail e senha. _(mantido da v1)_
- RF-03 — O sistema deve oferecer um fluxo de **cadastro de novo usuário** (e-mail/senha ou Google) para quem ainda não tem conta.
- RF-04 — Ao autenticar, o sistema deve verificar se é **primeiro acesso ou perfil incompleto**. Em caso positivo, redireciona **obrigatoriamente** para a configuração de perfil antes de liberar a home. Caso contrário, direciona direto para a home.
- RF-05 — O sistema deve permitir logout.

**Perfil**

- RF-06 — O usuário deve informar um nome/apelido exibível.
- RF-07 — O usuário pode, opcionalmente, adicionar uma foto.
- RF-08 — O usuário deve informar a localização: via geolocalização do navegador (com permissão) ou, alternativamente, cidade/bairro manual **(premissa: ambos os caminhos disponíveis)**.
- RF-09 — O usuário deve definir um raio de busca (ex.: 2 / 5 / 10 / 25 km) **(premissa: valores a confirmar)**.
- RF-10 — O usuário deve poder editar perfil, localização, raio e coleção de jogos a qualquer momento.

**Catálogo de jogos via BGG (BGG XML API2)**

- RF-11 — Ao digitar o nome de um jogo no cadastro da coleção, o sistema deve **consultar a BGG XML API2** e retornar uma lista de candidatos para o usuário escolher.
  - Endpoint de busca: `https://boardgamegeek.com/xmlapi2/search?query={TERMO}&type=boardgame` (espaços no termo viram `+`). Opcionalmente `&exact=1` para casar nome exato.
  - Detalhe de um item (para exibir ano/capa antes de confirmar): `https://boardgamegeek.com/xmlapi2/thing?id={ID}` (retorna `name`, `yearpublished`, `thumbnail`/`image`).
  - Usar **sempre** o domínio `boardgamegeek.com` (evitar `www`, que pode interferir na autorização das requisições).
- RF-12 — Cada candidato deve ser exibido com dados suficientes para desambiguação: **nome, ano de publicação e capa/thumbnail** (quando disponível). O usuário deve **confirmar** qual jogo entra na coleção antes de salvá-lo.
- RF-13 — Ao confirmar, o sistema deve armazenar o **ID BGG** do jogo (e nome/ano/thumbnail em cache) como identificador canônico, garantindo que dois usuários referenciem exatamente o mesmo jogo/edição.
- RF-14 — O usuário deve poder adicionar e remover jogos da sua coleção.
- RF-15 — O sistema deve tratar as restrições da BGG: **rate limit** (esperar ~5s entre requisições; tratar retornos 500/503 com retry/backoff), resultado paginado/limitado (máx. ~20 itens), latência de resposta (mostrar estado de carregamento) e **indisponibilidade** da API (mensagem de erro clara + opção de tentar novamente). **(premissa: cache local dos resultados para reduzir chamadas)**

**Home e os dois modos de busca**

- RF-16 — A home deve oferecer **dois modos** claramente distinguíveis:
  - **Modo A – "Quero jogar":** selecionar um jogo da própria coleção e sinalizar intenção de jogar, iniciando a busca por pessoas próximas que também querem jogar aquele jogo.
  - **Modo B – "Buscar jogos":** pesquisar um jogo específico (catálogo/BGG) e ver pessoas próximas que possuem aquele jogo e sinalizaram querer jogá-lo.
- RF-17 — Em ambos os modos, a busca deve retornar apenas usuários que (a) referenciam o mesmo jogo, (b) sinalizaram **intenção de jogar** aquele jogo e (c) estão dentro do raio configurado.
- RF-18 — Os resultados devem vir ordenados por distância (mais próximo primeiro).
- RF-19 — Cada item da lista deve exibir nome/apelido, foto (se houver), distância aproximada e o jogo em comum (e demais jogos em comum, se houver). **A lista não deve exibir dados de contato.**
- RF-20 — Quando não houver resultados, o sistema deve exibir mensagem clara e oferecer a opção de ampliar o raio ou trocar de jogo.

**Intenção de jogar, match (aceite mútuo) e contato**

- RF-21 — O usuário deve poder sinalizar **intenção de jogar** um jogo específico (estado "quero jogar"), que é o que o torna encontrável nas buscas daquele jogo. **(premissa: a intenção pode ter validade/expiração — ex.: 7 dias — a confirmar)**
- RF-22 — A partir de um resultado, o usuário deve poder enviar um **pedido de interesse** ("quero jogar com você") para outro usuário, referente a um jogo específico.
- RF-23 — O usuário que recebe um pedido de interesse deve poder **aceitar** ou **recusar**. Os pedidos recebidos e enviados ficam visíveis numa área de **"Convites/Matches"** dentro do app (sem push na v1).
- RF-24 — Quando **as duas partes** manifestam interesse (envio + aceite, ou interesse recíproco), forma-se um **match**. Somente após o match o sistema pode liberar o contato de ambos.
- RF-25 — Após o match, cada parte deve ter uma ação de "entrar em contato" que redireciona para WhatsApp ou Telegram da outra. **O contato nunca é exibido antes do match.**
- RF-26 — O sistema deve registrar os eventos: interesse enviado, interesse recebido, match formado, recusa e clique em "entrar em contato" (para métricas — ver RNF-09).

**Privacidade e conta**

- RF-27 — O usuário deve consentir explicitamente com o uso de localização.
- RF-28 — O usuário deve poder excluir sua conta e seus dados (deixando de aparecer em buscas e cancelando matches/pendências).

---

## 7. Requisitos não-funcionais

**Experiência / design**

- RNF-01 — **Web app responsivo, mobile-first**, otimizado para celular; desktop suportado mas não é o foco.
- RNF-02 — O fluxo crítico (login/cadastro → perfil → home → busca → interesse → match → contato) deve ser concluível com o mínimo de toques.
- RNF-03 — Estados vazios, de carregamento e de erro devem ser explícitos em todas as telas de busca, perfil e na consulta à BGG.

**Performance e integração externa**

- RNF-04 — A busca de pessoas deve retornar em tempo percebido como instantâneo para a base inicial **(premissa: < 2s; a confirmar)**.
- RNF-05 — A consulta à BGG (autocomplete/confirmação) deve exibir estado de carregamento e **respeitar o rate limit da BGG (~5s entre chamadas, backoff em 500/503)**; recomenda-se **debounce** na digitação e **cache** de resultados para não exceder o limite. Toda a integração BGG deve ser feita **server-side** (proxy no backend), nunca direto do cliente, por controle de rate limit, CORS e resiliência.

**Segurança e privacidade**

- RNF-06 — Senhas armazenadas com hash (nunca em texto puro).
- RNF-07 — A localização exata **nunca** é exposta a terceiros; apenas distância aproximada (ex.: "a ~3 km").
- RNF-08 — Conformidade com LGPD: consentimento de localização, finalidade clara, direito de exclusão (RF-27, RF-28).
- RNF-09 — O contato (WhatsApp/Telegram) de um usuário **só é exposto após match mútuo** (RF-24/RF-25).

**Observabilidade**

- RNF-10 — Instrumentar eventos do funil: cadastro concluído, perfil completo, busca realizada (por modo), busca com zero resultado, interesse enviado, match formado, clique em contato.

**Acessibilidade**

- RNF-11 — Contraste e tamanho de toque adequados a mobile; navegação por leitor de tela no fluxo crítico **(premissa: esforço a calibrar com design)**.

---

## 8. Critérios de aceitação (Given / When / Then)

**Roteamento por estado da conta (fluxograma)**

- **Given** um usuário que faz login **When** é seu primeiro acesso (ou o perfil está incompleto) **Then** o sistema o leva à configuração de perfil e só libera a home após salvar nome, localização e ao menos 1 jogo.
- **Given** um usuário já cadastrado e com perfil completo **When** ele faz login **Then** o sistema o leva **direto para a home**, sem passar pela configuração de perfil.

**Cadastro de novo usuário**

- **Given** uma pessoa sem conta **When** ela usa "Criar conta" e conclui o cadastro **Then** o sistema cria a conta e a direciona para a configuração de perfil.

**Cadastro de jogo via BGG**

- **Given** um usuário na configuração de perfil **When** ele digita o nome de um jogo **Then** o sistema consulta a BGG e exibe candidatos (nome + ano + capa quando houver) para ele **confirmar** antes de adicionar à coleção.
- **Given** a BGG está indisponível ou lenta **When** o usuário busca um jogo **Then** o sistema mostra estado de carregamento e, se falhar, mensagem de erro com opção de tentar novamente — sem travar o preenchimento do restante do perfil.

**Busca — Modo A (quero jogar)**

- **Given** um usuário com perfil completo **When** ele escolhe um jogo da sua coleção e sinaliza "quero jogar" **Then** o sistema retorna pessoas próximas, dentro do raio, que também querem jogar aquele jogo, ordenadas por distância, sem exibir contato.

**Busca — Modo B (buscar jogos)**

- **Given** um usuário na home **When** ele pesquisa um jogo específico **Then** o sistema retorna pessoas próximas que têm aquele jogo e sinalizaram querer jogá-lo, ordenadas por distância, sem exibir contato.

**Busca sem resultados**

- **Given** uma busca executada **When** ninguém corresponde ao jogo dentro do raio **Then** o sistema exibe "ninguém por aqui ainda" e atalhos para ampliar o raio ou trocar de jogo.

**Match e liberação de contato**

- **Given** o usuário A envia interesse para o usuário B em um jogo **When** B aceita o pedido **Then** forma-se um match e **apenas então** o contato de ambos fica disponível para os dois.
- **Given** o usuário A enviou interesse **When** B ainda não respondeu **Then** o contato permanece oculto e A vê o pedido como "pendente".
- **Given** um match formado **When** o usuário clica em "entrar em contato" **Then** o sistema redireciona para o WhatsApp/Telegram correspondente e registra o evento.

**Privacidade da localização**

- **Given** dois usuários distintos **When** um aparece na lista do outro **Then** apenas a distância aproximada é exibida, nunca o endereço ou as coordenadas exatas.

**Exclusão de conta**

- **Given** um usuário autenticado **When** ele solicita a exclusão **Then** o sistema remove seus dados, cancela matches/pendências e ele deixa de aparecer em qualquer busca.

---

## 9. Edge cases e riscos

**Risco de liquidez (o maior).** Produto de pareamento sem massa numa mesma região devolve listas vazias. O passo de match **aumenta a fricção** e torna a densidade ainda mais crítica. Mitigação: instrumentar "busca com zero resultado" e "interesse sem reciprocidade" (RNF-10) e concentrar o lançamento em uma única cidade/região **(premissa)**.

**Privacidade do contato — decisão tomada.** A v1 deixava em aberto entre "contato visível a qualquer logado" e "aceite mútuo". A v2 adota **aceite mútuo (match)**: contato só após as duas partes toparem. Mais seguro, ao custo de mais esforço de engenharia (estado de interesse, pedidos, matches).

**Edge cases da integração BGG:**

- Termo sem resultados no BGG → mensagem "não encontramos esse jogo" e opção de refinar a busca.
- Nomes ambíguos/edições múltiplas → a confirmação com ano + capa desambigua; o ID BGG é a chave canônica (RF-13).
- Rate limit atingido (500/503) → backoff e retry; debounce + cache para prevenir (RNF-05).
- API fora do ar → não bloquear o resto do perfil; permitir concluir e adicionar jogos depois.
- Jogo inexistente no BGG → aceitar a limitação na v1 ou oferecer canal simples de solicitação **(premissa)**.

**Edge cases de match:**

- Pedidos pendentes acumulados / spam de interesse → limitar/So sinalizar; considerar expiração da intenção (RF-21) e dos pedidos **(premissa)**.
- B recusa → A não recebe contato e não é notificado de forma constrangedora (apenas "não deu match" **(premissa)**).
- Ambos enviam interesse quase ao mesmo tempo → tratar como match imediato (idempotência).

**Edge cases de localização:**

- Baixa densidade → reforçar "ampliar raio".
- Mudança de cidade → localização facilmente atualizável (RF-10).
- Geolocalização imprecisa → entrada manual como fallback (RF-08).

**Edge cases de conta:**

- E-mail duplicado no cadastro → bloquear com mensagem clara.
- Conta Google e depois e-mail/senha com o mesmo e-mail → política de unificação **(premissa)**.

**Risco de segurança comportamental.** Encontro entre estranhos combinado pelo app carrega risco offline; o match reduz (mas não elimina) exposição. Manter aviso de segurança/termos na v1 **(premissa)**.

---

## 10. Dependências e plano de validação

**Dependências técnicas:**

- Provedor de OAuth do Google.
- Geolocalização do navegador + cálculo de distância por raio no backend (sem indexação espacial sofisticada no MVP).
- **BGG XML API2** para o catálogo (search + thing), consumida **server-side** com rate limit, cache e tratamento de erro (RF-11 a RF-15, RNF-05).
- Deep links de WhatsApp (`wa.me`) e/ou Telegram para o redirecionamento **pós-match**.
- Modelo de dados de **intenção de jogar**, **pedidos de interesse** e **matches**.
- Stack de analytics/eventos para o funil (RNF-10).

**Dependências de produto/negócio:**

- Regra de expiração de intenção/pedidos **(premissa)**.
- Região/cidade de lançamento inicial.
- Termos de uso e política de privacidade (LGPD), incluindo uso de dados da BGG conforme os termos do BoardGameGeek.

**Plano de validação:**

1. **Baseline antes de meta:** rodar numa região concentrada, coletar o funil completo (incluindo interesse→match→contato) por algumas semanas e só então definir metas.
2. **Sinal de validação:** taxa de contato pós-match consistentemente acima de zero e crescente, com massa relevante de buscas retornando resultados e interesses virando match.
3. **Sinal de invalidação:** muitas buscas com zero resultado mesmo com cadastros crescendo (densidade), ou muitos interesses sem reciprocidade (fricção do match / proposta de valor).
4. **Instrumentação como pré-requisito de lançamento:** sem os eventos de funil instrumentados, o MVP não vai ao ar.

---

## Trade-offs

**O que se ganha:**

- **Segurança e confiança maiores** com o aceite mútuo antes de expor contato, endereçando o principal risco de privacidade da v1.
- **Catálogo confiável e sem curadoria manual** ao apoiar-se na base do BGG, com desambiguação por ano/capa e ID canônico.
- **Duas portas de entrada** (quero jogar / buscar jogos) cobrem tanto quem já sabe o que quer jogar quanto quem quer explorar o que há perto.
- **Velocidade e baixo custo mantidos:** ainda web mobile-first, ainda sem chat interno (contato vai para WhatsApp/Telegram **após o match**).

**O que se perde / riscos assumidos:**

- **Mais fricção no funil:** o match adiciona um passo entre descobrir e conversar; pode reduzir volume de contatos — por isso medimos interesse→match desde o dia 1.
- **Dependência de terceiro (BGG):** rate limit, latência e indisponibilidade da API viram risco de produto; mitigado com proxy server-side, cache e estados de erro.
- **Densidade ainda mais crítica:** com o match, a base precisa de reciprocidade local; reforça a recomendação de concentrar o lançamento.
- **Sem retenção construída:** sem push/eventos, há pouco que traga o usuário de volta (a área de Convites/Matches in-app é o mínimo). Aceitável para validar descoberta+match, insuficiente para escalar.

> Em uma frase: a v2 troca um pouco de velocidade de contato por **segurança (match mútuo)** e **confiabilidade de catálogo (BGG)**, mantendo o MVP enxuto e web-first — e essa troca só vale se medirmos o funil inteiro, incluindo interesse→match→contato, desde o primeiro dia.
