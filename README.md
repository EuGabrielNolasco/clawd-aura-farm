# Clawd Aura Farm

[![Jogar agora](https://img.shields.io/badge/jogar-GitHub%20Pages-ffd166?style=flat-square)](https://eugabrielnolasco.github.io/clawd-aura-farm/)
[![Deploy](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml/badge.svg)](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-Vite-d97757?style=flat-square)

Jogo incremental (*idle clicker*) para o navegador. O Clawd, mascote do Claude Code, faz o **six seven** sem parar enquanto você farma aura, sobe por 11 níveis, completa a loja e disputa o ranking global.

**[▶ Jogar agora](https://eugabrielnolasco.github.io/clawd-aura-farm/)**

## Sumário

- [Funcionalidades](#funcionalidades)
- [Como jogar](#como-jogar)
- [Níveis](#níveis)
- [Loja](#loja)
- [Ranking e segurança](#ranking-e-segurança)
- [Rodando localmente](#rodando-localmente)
- [Configurando o ranking (Supabase)](#configurando-o-ranking-supabase)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Funcionalidades

- **Progressão longa:** cerca de 3 dias até o nível máximo e cerca de 1 semana para completar a loja.
- **Loja com 6 upgrades**, cada um com limite de compras: dá para completar tudo.
- **Progresso offline:** o Clawd continua farmando enquanto você está fora, até 12 horas.
- **Ranking global** com apelido, calculado no servidor e protegido contra trapaça.
- **Golpes críticos:** 10% de chance base, até 40% com upgrades, valendo 10 vezes mais.
- **Efeitos visuais que se acumulam:** holofote, óculos, anel arco-íris, coroa, asas, raios, clones e chuva de 67.
- **Efeitos sonoros 8-bit** sintetizados no navegador, com botão de mudo.
- **Acessível:** dá para jogar pelo teclado (`Enter` ou `Espaço` sobre o Clawd), e as animações são desligadas quando o sistema pede movimento reduzido.
- **Responsivo:** no celular, a loja abre como gaveta.

## Como jogar

1. Clique no Clawd ou no botão **FARMAR AURA**.
2. Gaste a aura na **loja**. Os upgrades de aura por segundo continuam rendendo mesmo com o jogo fechado.
3. O nível é definido pela **aura total farmada**, então gastar na loja não faz você cair de nível.
4. Abra o **Ranking**, escolha um apelido e veja sua posição.
5. **Zerar aura** recomeça o progresso, mas seu recorde continua no ranking.

## Níveis

A economia foi calibrada por simulação. Os tempos abaixo são de um jogador com 3 sessões de 40 minutos por dia; quem joga menos chega um pouco depois, porque a aura passiva faz a maior parte do trabalho.

| # | Nível | Aura total | Tempo aproximado | Efeito |
|--:|---|--:|--:|---|
| 0 | NPC | 0 | início | nenhum |
| 1 | Figurante | 270 mil | 1 min | brilho fraco |
| 2 | Main character | 3,6 mi | 5 min | holofote |
| 3 | Sigma | 26 mi | 20 min | óculos escuros e fundo roxo |
| 4 | Aura infinita | 67 mi | 1 h | anel arco-íris |
| 5 | Lenda do 6-7 | 91 mi | 3 h | coroa e fogo |
| 6 | Ascendido | 130 mi | 6 h | asas e céu estrelado |
| 7 | Deus do 6-7 | 1,2 bi | 12 h | Clawd dourado, raios e tela tremendo |
| 8 | Multiverso | 7,5 bi | 1 dia | clones e um 67 gigante ao fundo |
| 9 | Clawd Supremo | 44 bi | 2 dias | cores da tela girando |
| 10 | O Próprio 67 | 150 bi | 3 dias | chuva de 67 |

Cada nível também dá +15% em toda a aura.

## Loja

O preço de cada upgrade sobe a cada compra. Completar todos leva cerca de 1 semana.

| Upgrade | Efeito por compra | Preço inicial | Aumento por compra | Limite |
|---|---|--:|--:|--:|
| Clawd auxiliar | +2 de aura por segundo | 50 | ×1,18 | 40 |
| Mão firme | +50% de aura por clique | 200 | ×1,3 | 30 |
| Olhar sigma | +3% de chance de crítico | 5 mil | ×2,2 | 10 |
| Fábrica de 67 | +60 de aura por segundo | 20 mil | ×1,22 | 30 |
| Datacenter do Clawd | +4.000 de aura por segundo | 20 mi | ×1,25 | 30 |
| Aura cósmica | dobra toda a aura | 2,7 bi | ×5 | 5 |

## Ranking e segurança

No modo online, **quem calcula a aura é o servidor**. O navegador nunca envia "tenho X de aura": ele envia só eventos ("cliquei", "comprei tal upgrade"), e o banco aplica as mesmas regras do jogo.

- Cliques são limitados a 15 por segundo, com rajada de até 60. Um robô de cliques não passa disso.
- A aura passiva é calculada pelo relógio do servidor, com teto de 12 horas offline.
- Críticos são rolados no servidor.
- A tabela não pode ser lida nem alterada diretamente pela API. Tudo passa por funções que conferem o segredo do jogador.
- Apelidos são validados no servidor e exibidos como texto, nunca como HTML.
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

## Estrutura do projeto

```
.
├── index.html               # marcação: palco, mascote em SVG, HUD, loja e ranking
├── public/favicon.svg       # ícone do jogo
├── src/
│   ├── main.ts              # liga o DOM às regras: render, cliques, loja, ranking
│   ├── game.ts              # regras puras: níveis, ganhos, críticos, upgrades
│   ├── game.test.ts         # testes das regras, incluindo paridade com o servidor
│   ├── online.ts            # cliente do Supabase: envio de eventos em lote e ranking
│   ├── storage.ts           # save local e identidade do jogador
│   ├── sound.ts             # efeitos sonoros com Web Audio
│   ├── fx.ts                # efeitos em Canvas: partículas, fogo, raios, estrelas
│   └── style.css            # visual e efeitos por nível (classes l1 a l10)
├── supabase/
│   ├── schema.sql           # tabela, regras do jogo no servidor e permissões
│   ├── test.sql             # testes do servidor (permissões, limites, paridade)
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

Mudou alguma regra do jogo em `src/game.ts`? Espelhe a mudança em `supabase/schema.sql`, senão o ranking diverge do que o jogador vê. O teste de paridade nos dois lados avisa quando isso acontece.

Bugs e sugestões podem ser enviados pelas [issues](https://github.com/EuGabrielNolasco/clawd-aura-farm/issues). Para falhas de segurança, veja o [SECURITY.md](SECURITY.md).

## Licença

O código está sob a licença [MIT](LICENSE).

> **Aviso:** este é um projeto de fã, sem vínculo oficial com a Anthropic. O nome Claude e o personagem Clawd são propriedade da Anthropic e não estão cobertos pela licença MIT.

---

Desenvolvido com o [Claude Code](https://claude.com/claude-code).
