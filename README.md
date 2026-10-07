# Clawd Aura Farm

[![Jogar agora](https://img.shields.io/badge/jogar-GitHub%20Pages-ffd166?style=flat-square)](https://eugabrielnolasco.github.io/clawd-aura-farm/)
[![Deploy](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml/badge.svg)](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-Vite-d97757?style=flat-square)

Jogo incremental (*idle clicker*) para o navegador. O Clawd, mascote do Claude Code, faz o **six seven** sem parar enquanto você farma aura, sobe por 16 níveis cheios de memes BR, caça Cérebros Dourados, veste o Clawd com enfeites e disputa o ranking global.

**[▶ Jogar agora](https://eugabrielnolasco.github.io/clawd-aura-farm/)**

## Sumário

- [Documentação viva (`docs/`)](#documentação-viva)
- [Funcionalidades](#funcionalidades)
- [Como jogar](#como-jogar)
- [Sincronização PC ⇄ Celular](#sincronização-pc--celular)
- [Roleta da Sorte 67](#roleta-da-sorte-67)
- [Níveis](#níveis)
- [Loja](#loja)
- [Eventos, conquistas e enfeites](#eventos-conquistas-e-enfeites)
- [Ranking e segurança](#ranking-e-segurança)
- [Rodando localmente](#rodando-localmente)
- [Configurando o ranking (Supabase)](#configurando-o-ranking-supabase)
- [Painel dev](#painel-dev)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)
- [Licença](#licença)


## Documentação Viva

O projeto conta com uma central de documentação completa e atualizada em [`docs/`](docs/):

- **[docs/INDEX.md](docs/INDEX.md):** Hub central da documentação viva.
- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md):** Arquitetura técnica, segurança, anti-cheat e CSP.
- **[docs/CONTAS_E_SINCRONIZACAO.md](docs/CONTAS_E_SINCRONIZACAO.md):** Guia de sincronização entre PC e Celular via QR Code, chave e links.
- **[docs/MECANICAS_E_ECONOMIA.md](docs/MECANICAS_E_ECONOMIA.md):** Fórmulas matemáticas, curvas dos 16 níveis e eventos.
- **[docs/CONQUISTAS_E_COSMETICOS.md](docs/CONQUISTAS_E_COSMETICOS.md):** As 15 conquistas e os 16 enfeites em pixel art SVG.
- **[docs/CHANGELOG.md](docs/CHANGELOG.md):** Histórico completo de versões (v1.0.0 a v2.1.0).
- **[docs/ROADMAP.md](docs/ROADMAP.md):** Próximas ideias e melhorias planejadas.

## Funcionalidades

- **Sincronização entre PC e Celular:** Jogue no celular e continue no computador (ou vice-versa). Acesso via **QR Code**, link direto de compartilhamento (`#sync=...`), chave da conta `AURA_...` ou backup em arquivo JSON.
- **Roleta da Sorte 67:** Minigame diário de engajamento! Ganhe giros diários e gire a roleta para faturar Fichas 67, ativação instantânea do Mega Brain ou rajadas de aura passiva.
- **Painel de Estatísticas da Carreira:** Acompanhe cliques totais, taxa real de crítico, recordes de combo e eventos capturados.
- **Barras de Progresso nas Conquistas:** Veja visualmente o quanto falta para desbloquear cada uma das 15 conquistas.
- **Feedback Tátil & Mobile First:** Vibração háptica no celular (`navigator.vibrate`) em cliques normais, críticos e eventos, além de medidor de CPS em tempo real.
- **Instalável (PWA):** Adicione à tela inicial do celular como aplicativo nativo, rodando em tela cheia sem barra de navegador.
- **16 níveis com memes BR**, de NPC a O Próprio 67, passando por Cria, Brabo, O Pai Tá On, Mega Brain e Coop Thief.
- **Combo de cliques:** clicar rápido multiplica a aura até ×3.
- **Cérebro Dourado:** aparece de vez em quando; pegar ativa o *Modo Mega Brain*, com HUD estilo Jarvis e ×7 em toda a aura por 67 segundos.
- **Ladrão do Coop Thief:** a partir do nível 8, um ladrãozinho atravessa a tela; pegar rende Fichas 67 e +1 giro na Roleta.
- **Loja com 6 upgrades**, cada um com limite de compras.
- **Fichas 67, conquistas e login diário:** 15 conquistas e uma recompensa por dias seguidos jogando.
- **Loja de enfeites:** 16 itens entre fundos, chapéus, óculos, roupas e cores para o Clawd, pagos com Fichas 67.
- **Prestígio:** no último nível dá para renascer com +25% de aura para sempre.
- **Ranking global** com o Top 10, quem está perto de você e um aviso de quanto falta para passar o próximo. Os enfeites de cada jogador aparecem no ranking.
- **Progresso offline:** o Clawd continua farmando enquanto você está fora, até 12 horas.
- **Efeitos sonoros 8-bit** sintetizados no navegador (fanfarras por nível, reator do Mega Brain, ladrão, conquistas), com botão de mudo.
- **Seguro contra trapaça:** no modo online, o servidor calcula tudo.
- **Acessível e responsivo:** dá para jogar pelo teclado, as animações respeitam o movimento reduzido e, no celular, a loja abre como gaveta.

## Como jogar

1. Clique no Clawd ou no botão **FARMAR AURA**. Clicar rápido enche o **combo**.
2. Gaste a aura na **loja**. Os upgrades de aura por segundo continuam rendendo mesmo com o jogo fechado.
3. Fique de olho no **Cérebro Dourado** voando pela tela e, a partir do nível Coop Thief, no **ladrão**.
4. Junte **Fichas 67** com conquistas, login diário, ladrões e a **Roleta**, e gaste em **enfeites**.
5. O nível é definido pela aura farmada nesta vida, então gastar na loja não faz você cair de nível.
6. No último nível, **renasça** para ganhar +25% permanente.
7. Abra o **Ranking**, escolha um apelido e veja quem está logo à sua frente.
8. Para jogar no celular e no computador com a mesma conta, use o painel **Conta & PC** e aponte a câmera para o QR Code!

## Sincronização PC ⇄ Celular

O jogo não prende seu save ao navegador:
- **Escanear QR Code:** Abra a aba **Conta & PC** no computador e aponte a câmera do celular para o QR Code. O celular abre direto com o seu save sincronizado!
- **Copiar Link Direto:** Clique em *Copiar Link de Acesso Direto* e envie para si mesmo no WhatsApp ou e-mail. Ao abrir, a conta é carregada na hora.
- **Chave da Conta:** Você pode copiar seu código `AURA_...` e colar na caixa *Entrar em uma conta existente* em qualquer dispositivo.
- **Backup JSON:** Exporte e importe saves em arquivo para segurança 100% offline.

## Roleta da Sorte 67

Um minigame diário para manter você progredindo:
- **Como ganhar giros:** 1 giro grátis no primeiro login de cada dia, +1 giro a cada subida de nível e +1 giro ao capturar o ladrão.
- **Prêmios:** Fichas 67 (5, 10 ou 25), Rajadas de Aura Passiva instantânea (10 ou 15 minutos de produção) e Ativação do Modo Mega Brain (×7 por 67s)!

## Níveis


A economia foi calibrada por simulação. Os tempos abaixo são de um jogador com 3 sessões de 40 minutos por dia, clicando 4 vezes por segundo e pegando os Cérebros Dourados. Quem joga menos chega um pouco depois, porque a aura passiva faz a maior parte do trabalho.

| # | Nível | Aura total | Tempo aproximado | Efeito |
|--:|---|--:|--:|---|
| 0 | NPC | 0 | início | nenhum |
| 1 | Figurante | 66 mil | 20 s | brilho fraco |
| 2 | Cria | 400 mil | 1 min | brilho mais forte |
| 3 | Brabo | 1,8 mi | 2,5 min | sobrancelhas bravas |
| 4 | O Pai Tá On | 17 mi | 5 min | corrente de ouro |
| 5 | Main character | 28 mi | 10 min | holofote |
| 6 | Sigma | 90 mi | 20 min | óculos escuros e fundo roxo |
| 7 | Mega Brain | 270 mi | 40 min | cérebro gigante com sinapses |
| 8 | Coop Thief | 390 mi | 1,5 h | saco de aura roubada e o evento do ladrão |
| 9 | Aura infinita | 650 mi | 3 h | anel arco-íris |
| 10 | Lenda do 6-7 | 1,2 bi | 6 h | coroa e fogo |
| 11 | Ascendido | 4,6 bi | 12 h | asas e céu estrelado |
| 12 | Deus do 6-7 | 15 bi | 1 dia | Clawd dourado, raios e tela tremendo |
| 13 | Multiverso | 45 bi | 40 h | clones e um 67 gigante ao fundo |
| 14 | Clawd Supremo | 98 bi | 56 h | cores da tela girando |
| 15 | O Próprio 67 | 270 bi | 3 dias | chuva de 67 |

Cada nível dá +10% em toda a aura, e cada prestígio mais +25%.

## Loja

Paga com aura. O preço de cada upgrade sobe a cada compra, e completar todos leva cerca de 1 semana.

| Upgrade | Efeito por compra | Preço inicial | Aumento por compra | Limite |
|---|---|--:|--:|--:|
| Clawd auxiliar | +2 de aura por segundo | 50 | ×1,18 | 40 |
| Mão firme | +50% de aura por clique | 200 | ×1,3 | 30 |
| Olhar sigma | +3% de chance de crítico | 5 mil | ×2,2 | 10 |
| Fábrica de 67 | +60 de aura por segundo | 20 mil | ×1,22 | 30 |
| Datacenter do Clawd | +4.000 de aura por segundo | 20 mi | ×1,25 | 30 |
| Aura cósmica | dobra toda a aura | 3,2 bi | ×5 | 5 |

## Eventos, conquistas e enfeites

| Evento | Quando | O que dá |
|---|---|---|
| Cérebro Dourado | a cada 3 a 8 min, fica 13 s na tela | Modo Mega Brain: ×7 em toda a aura por 67 s |
| Ladrão | a partir do nível 8, a cada 4 a 10 min, fica 8 s na tela | 3 Fichas 67 |
| Login diário | primeiro acesso do dia (horário de Brasília) | 5 fichas × dias seguidos, até 35 |
| Combo | clicando mais de 3 vezes por segundo | até ×3 por clique, a 12 cliques/s |

As **15 conquistas** vão de "Seis sete" (67 cliques) a "Uma semana de aura" (7 dias seguidos) e dão de 5 a 50 fichas cada. A lista fica em [`src/achievements.ts`](src/achievements.ts).

A **loja de enfeites** tem 16 itens em 5 categorias (fundo, chapéu, rosto, roupa e cor), de 15 a 120 fichas. Entre eles estão a Favela neon, a Praia de Copacabana, o Capacete Mega Brain, os Óculos Juliet e a Camisa da seleção. O catálogo fica em [`src/cosmetics.ts`](src/cosmetics.ts).

## Ranking e segurança

No modo online, **quem calcula tudo é o servidor**. O navegador nunca envia "tenho X de aura" ou "tenho Y fichas": ele envia só eventos ("cliquei", "peguei o cérebro", "comprei tal item"), e o banco aplica as mesmas regras do jogo.

- Cliques são limitados a 15 por segundo, com rajada de até 60, e o combo vem da taxa que o servidor mede.
- Aura passiva, Cérebro Dourado, ladrão e login diário usam o relógio do servidor. O cérebro e o ladrão só valem dentro da janela em que aparecem.
- Críticos são rolados no servidor.
- Fichas, conquistas e enfeites também são do servidor: não dá para comprar sem saldo, equipar o que não tem ou ganhar a mesma conquista duas vezes.
- A tabela não pode ser lida nem alterada diretamente pela API. Tudo passa por funções que conferem o segredo do jogador.
- Apelidos são validados no servidor e exibidos como texto, nunca como HTML. Os enfeites de outros jogadores só são desenhados se existirem no catálogo do jogo.
- O site publicado tem Content Security Policy: só roda scripts do próprio site e só conversa com o Supabase.

Os detalhes e os limites conhecidos estão em [SECURITY.md](SECURITY.md).

Sem o Supabase configurado, o jogo funciona offline, com o progresso salvo só no navegador e sem ranking.

## Rodando localmente

Requer [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
git clone https://github.com/EuGabrielNolasco/clawd-aura-farm.git
cd clawd-aura-farm
npm install
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com recarga automática |
| `npm test` | roda os testes das regras do jogo (Vitest) |
| `npm run build` | checa os tipos e gera o site estático em `dist/` |
| `npm run preview` | serve o `dist/` localmente para conferir o build |

Para rodar os testes do servidor com Docker:

```bash
docker run -d --rm --name aura-pg -e POSTGRES_PASSWORD=pg postgres:17-alpine
cat supabase/test-setup.sql supabase/schema.sql supabase/test.sql \
  | docker exec -i aura-pg psql -U postgres -v ON_ERROR_STOP=1 -q
```

## Configurando o ranking (Supabase)

1. Crie um projeto grátis em [supabase.com](https://supabase.com/).
2. No **SQL Editor**, cole e rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Para rodar localmente, copie `.env.example` para `.env.local` e preencha os dois valores.
5. Para o site publicado, crie as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` em **Settings → Secrets and variables → Actions → Variables** do repositório.

A chave anon é pública por design e pode ficar no site. **Nunca** use a chave `service_role` no front-end.

## Painel dev

Com `npm run dev`, aparece um botão 🛠 no canto inferior esquerdo. Ele abre um painel para testar o jogo sem farmar:

- subir e descer de nível, ou pular direto para qualquer um;
- ganhar aura e Fichas 67, completar a loja e liberar todos os enfeites;
- forçar o Cérebro Dourado e o ladrão;
- simular um novo dia (login diário) e ir ao nível máximo (prestígio);
- zerar tudo.

O painel **não existe no build de produção**: o Vite remove o código, então ninguém consegue usá-lo no site publicado. Se o ranking estiver configurado, o painel entra em **modo sandbox** e para de sincronizar, para nunca alterar o servidor.

## Estrutura do projeto

```
.
├── index.html               # marcação: palco, mascote em SVG, HUD, loja e ranking
├── public/favicon.svg       # ícone do jogo
├── src/
│   ├── main.ts              # liga o DOM às regras: render, cliques, eventos, menu
│   ├── game.ts              # regras puras: níveis, ganhos, combo, eventos, prestígio
│   ├── achievements.ts      # conquistas
│   ├── cosmetics.ts         # catálogo e desenhos dos enfeites
│   ├── mini.ts              # mini Clawd com enfeites (prévia e ranking)
│   ├── dev.ts               # painel dev (só em npm run dev)
│   ├── game.test.ts         # testes das regras, incluindo paridade com o servidor
│   ├── schema-sync.test.ts  # falha se game.ts e schema.sql divergirem
│   ├── online.ts            # cliente do Supabase: envio de eventos em lote e ranking
│   ├── storage.ts           # save local e identidade do jogador
│   ├── sound.ts             # efeitos sonoros com Web Audio
│   ├── fx.ts                # efeitos em Canvas: partículas, fogo, raios, estrelas
│   └── style.css            # visual e efeitos por nível (classes l1 a l10)
├── supabase/
│   ├── schema.sql           # tabela, regras do jogo no servidor e permissões
│   ├── test.sql             # testes do servidor (permissões, limites, eventos, paridade)
│   └── test-setup.sql       # papéis do Supabase para testar num Postgres puro
├── .github/
│   ├── workflows/deploy.yml # testes, build e publicação no GitHub Pages
│   └── dependabot.yml       # atualização semanal de dependências
├── vite.config.ts           # build e Content Security Policy
└── tsconfig.json
```

| Camada | Tecnologia |
|---|---|
| Linguagem e build | TypeScript + [Vite](https://vite.dev/) |
| Testes | [Vitest](https://vitest.dev/) e SQL no Postgres |
| Servidor do ranking | [Supabase](https://supabase.com/) (Postgres + PostgREST), sem SDK |
| Mascote | SVG em pixel art |
| Animações e efeitos | CSS e Canvas 2D |
| Som | Web Audio API |
| Fontes | [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) e [VT323](https://fonts.google.com/specimen/VT323) (Google Fonts) |

O jogo não tem dependências em produção: o build gera só HTML, CSS e JavaScript estáticos.

## Deploy

A cada push na `main`, o GitHub Actions roda os testes do servidor e do jogo, gera o build e publica o `dist/` no GitHub Pages. Pull Requests também rodam testes e build, mas não publicam.

Na primeira vez, mude a fonte do Pages para **GitHub Actions** em **Settings → Pages → Source**.

## Contribuindo

Contribuições são bem-vindas.

1. Faça um fork do repositório.
2. Instale as dependências com `npm install` e crie uma branch: `git checkout -b minha-feature`.
3. Confira se `npm test` e `npm run build` passam e faça o commit: `git commit -m "Adiciona minha feature"`.
4. Envie a branch: `git push origin minha-feature`.
5. Abra um Pull Request.

Mudou alguma regra do jogo em `src/game.ts`, `src/achievements.ts` ou `src/cosmetics.ts`? Espelhe a mudança em `supabase/schema.sql`, senão o ranking diverge do que o jogador vê. O `src/schema-sync.test.ts` e os testes de paridade avisam quando isso acontece.

Bugs e sugestões podem ser enviados pelas [issues](https://github.com/EuGabrielNolasco/clawd-aura-farm/issues). Para falhas de segurança, veja o [SECURITY.md](SECURITY.md).

## Licença

O código está sob a licença [MIT](LICENSE).

> **Aviso:** este é um projeto de fã, sem vínculo oficial com a Anthropic. O nome Claude e o personagem Clawd são propriedade da Anthropic e não estão cobertos pela licença MIT.

---

Desenvolvido com o [Claude Code](https://claude.com/claude-code).
